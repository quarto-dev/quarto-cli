/*
* jupyter-kernel.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync } from "fs/mod.ts";
import { join } from "path/mod.ts";
import { createHash } from "hash/mod.ts";

import { sleep } from "../core/async.ts";
import { message } from "../core/console.ts";
import { execProcess, ProcessResult } from "../core/process.ts";
import { resourcePath } from "../core/resources.ts";

import { ExecuteOptions } from "./engine.ts";
import { pythonBinary } from "./jupyter.ts";
import { quartoDataDir, quartoRuntimeDir } from "../core/appdirs.ts";

export async function executeKernelOneshot(
  options: ExecuteOptions,
): Promise<void> {
  // abort any existing keepalive kernel
  await abortKernel(options);

  // execute the notebook (save back in place)
  if (!options.quiet) {
    messageStartingKernel();
  }

  trace(options, "Executing notebook with oneshot kernel");
  const debug = !!options.kernel.debug;
  const result = await execJupyter("execute", { ...options, debug });

  if (!result.success) {
    return Promise.reject();
  }
}

export async function executeKernelKeepalive(
  options: ExecuteOptions,
): Promise<void> {
  // if we are in debug mode then tail follow the log file
  let serverLogProcess: Deno.Process | undefined;
  if (options.kernel.debug) {
    if (Deno.build.os !== "windows") {
      serverLogProcess = Deno.run({
        cmd: ["tail", "-F", "-n", "0", kernelLogFile()],
      });
    }
  }

  // if we have a restart request then abort before proceeding
  if (options.kernel.restart) {
    await abortKernel(options);
  }

  trace(options, "Connecting to kernel");
  const [conn, transport] = await connectToKernel(options);
  trace(options, "Kernel connection successful");
  try {
    trace(options, "Sending execute command to kernel");
    await writeKernelCommand(
      conn,
      "execute",
      transport.secret,
      { ...options },
    );
    trace(options, "Execute command sent, reading response");
    let leftover = "";
    while (true) {
      const buffer = new Uint8Array(512);

      const bytesRead = await conn.read(buffer);
      if (bytesRead === null) {
        break;
      }

      if (bytesRead > 0) {
        const payload = new TextDecoder().decode(
          buffer.slice(0, bytesRead),
        );

        const jsonMessages = payload.split("\n");

        for (let jsonMessage of jsonMessages) {
          if (!jsonMessage) {
            continue;
          }
          if (leftover) {
            jsonMessage = leftover + jsonMessage;
            leftover = "";
          }
          try {
            const msg: { type: string; data: string } = JSON.parse(
              jsonMessage,
            );
            message(msg.data, { newline: false });
            if (msg.type === "error") {
              trace(options, "Error response received");
              return Promise.reject();
            } else if (msg.type == "restart") {
              trace(options, "Restart request received");
              return executeKernelKeepalive(options);
            }
          } catch {
            leftover = jsonMessage;
          }
        }
      }
    }
    trace(options, "Server request complete\n\n");
  } catch (e) {
    trace(options, "Error occurred receiving response from server");
    // likely this is not our server! (as it's not producing/consuming the expected json)
    // in that case remove the connection file and re-throw the exception
    const transportFile = kernelTransportFile(options.target.input);
    if (existsSync(transportFile)) {
      Deno.removeSync(transportFile);
    }
    throw e;
  } finally {
    conn.close();

    if (serverLogProcess) {
      serverLogProcess.kill(9);
    }
  }
}

async function abortKernel(options: ExecuteOptions) {
  // connect to kernel if it exists and send abort command
  try {
    trace(options, "Checking for existing kernel");
    const [conn, transport] = await connectToKernel(options, false);
    trace(options, "Existing kernel found");
    try {
      trace(options, "Sending kernel abort request");
      await writeKernelCommand(conn, "abort", transport.secret, {});
      trace(options, "Abort request successful");
    } finally {
      const transportFile = kernelTransportFile(options.target.input);
      if (existsSync(transportFile)) {
        Deno.removeSync(transportFile);
      }
      conn.close();
    }
  } catch {
    trace(options, "No existing kernel found");
  }
}

function execJupyter(
  command: string,
  options: Record<string, unknown>,
): Promise<ProcessResult> {
  return execProcess(
    {
      cmd: [
        pythonBinary(),
        resourcePath("jupyter/jupyter.py"),
      ],
      stdout: "piped",
    },
    kernelCommand(command, "", options),
  );
}

async function writeKernelCommand(
  conn: Deno.Conn,
  command: string,
  secret: string,
  options: Record<string, unknown>,
) {
  await conn.write(
    new TextEncoder().encode(
      kernelCommand(command, secret, options) + "\n",
    ),
  );
}

function kernelCommand(
  command: string,
  secret: string,
  options: Record<string, unknown>,
) {
  return JSON.stringify(
    { command, secret, options: { ...options, log: kernelLogFile() } },
  );
}

interface KernelTransport {
  port: number | string;
  secret: string;
  type: "tcp" | "unix";
}

function kernelTransportFile(target: string) {
  const transportsDir = quartoRuntimeDir("jt");
  const targetFile = Deno.realPathSync(target);
  const hasher = createHash("md5");
  hasher.update(targetFile);
  const hash = hasher.toString("hex").slice(0, 20);
  return join(transportsDir, hash);
}

function kernelLogFile() {
  const logsDir = quartoDataDir("logs");
  const kernelLog = join(logsDir, "jupyter-kernel.log");
  if (!existsSync(kernelLog)) {
    Deno.writeTextFileSync(kernelLog, "");
  }
  return kernelLog;
}

function readKernelTransportFile(
  transportFile: string,
  type: "tcp" | "unix",
): KernelTransport | null {
  if (existsSync(transportFile)) {
    if (type === "tcp") {
      try {
        const transport = JSON.parse(Deno.readTextFileSync(transportFile));
        if (transport.port && transport.secret) {
          return {
            ...transport,
            type,
          };
        } else {
          throw new Error("Invalid file format");
        }
      } catch (e) {
        message(
          "Error reading kernel transport file: " + e.toString() +
            "(removing file)",
        );
        Deno.removeSync(transportFile);
        return null;
      }
    } else {
      return {
        port: transportFile,
        secret: "",
        type,
      };
    }
  } else {
    return null;
  }
}

async function connectToKernel(
  options: ExecuteOptions,
  startIfRequired = true,
): Promise<[Deno.Conn, KernelTransport]> {
  // see if we are in debug mode
  const debug = !!options.kernel.debug;

  // derive the file path for this connection
  const transportFile = kernelTransportFile(options.target.input);

  // determine connection type -- try to use unix domain sockets but use tcp for
  // windows or if the transportFile path is > 100, see here for details on why:
  // https://unix.stackexchange.com/questions/367008/why-is-socket-path-length-limited-to-a-hundred-chars
  const type = Deno.build.os === "windows" || transportFile.length >= 100
    ? "tcp"
    : "unix";

  // get the transport
  const transport = readKernelTransportFile(transportFile, type);

  // if there is a transport then try to connect to it
  if (transport) {
    try {
      return await denoConnectToKernel(transport);
    } catch (e) {
      // remove the transport file
      Deno.removeSync(transportFile);
    }
  }

  // we are done if there is no startIfRequired request
  if (!startIfRequired) {
    return Promise.reject();
  }

  // start the kernel
  if (!options.quiet) {
    messageStartingKernel();
  }

  // determine timeout
  const timeout = options.kernel.keepalive || 300;

  // try to start the server
  const result = await execJupyter("start", {
    transport: transportFile,
    timeout,
    type,
    debug,
  });
  if (!result.success) {
    return Promise.reject();
  }

  // poll for the transport file and connect once we have it
  for (let i = 1; i < 20; i++) {
    await sleep(i * 100);
    const kernelTransport = readKernelTransportFile(transportFile, type);
    if (kernelTransport) {
      try {
        return await denoConnectToKernel(kernelTransport);
      } catch (e) {
        // remove the transport file
        Deno.removeSync(transportFile);
        message("Error connecting to Jupyter kernel: " + e.toString());
        return Promise.reject();
      }
    }
  }

  message("Unable to start Jupyter kernel for " + options.target.input);
  return Promise.reject();
}

async function denoConnectToKernel(
  transport: KernelTransport,
): Promise<[Deno.Conn, KernelTransport]> {
  return [
    await Deno.connect(
      transport.type == "tcp"
        ? {
          transport: transport.type,
          hostname: "127.0.0.1",
          port: transport.port as number,
        }
        : {
          transport: transport.type,
          path: transport.port as string,
        },
    ),
    transport,
  ];
}

function messageStartingKernel() {
  message("\nStarting Jupyter kernel...", { newline: false });
}

function trace(options: ExecuteOptions, msg: string) {
  if (options.kernel.debug) {
    message("- " + msg, { bold: true });
  }
}
