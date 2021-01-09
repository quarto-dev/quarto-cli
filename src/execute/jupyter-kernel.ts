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
import { systemTempDir } from "../core/temp.ts";
import { execProcess, ProcessResult } from "../core/process.ts";
import { resourcePath } from "../core/resources.ts";

import { ExecuteOptions } from "./engine.ts";
import { pythonBinary } from "./jupyter.ts";

export async function executeKernelOneshot(
  options: ExecuteOptions,
): Promise<void> {
  // abort any existing keepalive kernel
  await abortKernel(options);

  // execute the notebook (save back in place)
  if (!options.quiet) {
    messageStartingKernel();
  }

  const result = await execJupyter("execute", options);

  if (!result.success) {
    return Promise.reject();
  }
}

export async function executeKernelKeepalive(
  options: ExecuteOptions,
): Promise<void> {
  // if we have a restart request then abort before proceeding
  if (options.kernel.restart) {
    await abortKernel(options);
  }

  const [conn, transport] = await connectToKernel(options);
  try {
    await writeKernelCommand(
      conn,
      "execute",
      transport.secret,
      options,
    );
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
              return Promise.reject();
            } else if (msg.type == "restart") {
              return executeKernelKeepalive(options);
            }
          } catch {
            leftover = jsonMessage;
          }
        }
      }
    }
  } catch (e) {
    // likely this is not our server! (as it's not producing/consuming the expected json)
    // in that case remove the connection file and re-throw the exception
    const transportFile = kernelTransportFile(options.target.input);
    if (existsSync(transportFile)) {
      Deno.removeSync(transportFile);
    }
    throw e;
  } finally {
    conn.close();
  }
}

async function abortKernel(options: ExecuteOptions) {
  // connect to kernel if it exists and send abort command
  try {
    const [conn, transport] = await connectToKernel(options, false);
    try {
      await writeKernelCommand(conn, "abort", transport.secret, null);
    } finally {
      conn.close();
    }
  } catch {
    //
  }
}

function execJupyter(
  command: string,
  options: unknown,
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
  options: unknown,
) {
  await conn.write(
    new TextEncoder().encode(kernelCommand(command, secret, options) + "\n"),
  );
}

function kernelCommand(command: string, secret: string, options: unknown) {
  return JSON.stringify({ command, secret, options });
}

interface KernelTransport {
  port: number | string;
  secret: string;
  type: "tcp" | "unix";
}

function kernelTransportFile(target: string) {
  const transportsDir = systemTempDir("quarto-3B64122B");
  const targetFile = Deno.realPathSync(target);
  const hasher = createHash("md5");
  hasher.update(targetFile);
  const hash = hasher.toString("hex").slice(0, 10);
  return join(transportsDir, hash);
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
  const timeout = options.kernel.keepalive === undefined
    ? 300
    : options.kernel.keepalive;

  // try to start the server
  const result = await execJupyter("start", {
    transport: transportFile,
    timeout,
    type,
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
  message("Starting Jupyter kernel...");
}
