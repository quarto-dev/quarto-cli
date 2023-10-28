/*
 * jupyter-kernel.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { existsSync } from "fs/mod.ts";
import { join } from "path/mod.ts";
import { error, info, warning } from "log/mod.ts";

import { sleep } from "../../core/async.ts";
import { quartoDataDir, quartoRuntimeDir } from "../../core/appdirs.ts";
import { execProcess } from "../../core/process.ts";
import { ProcessResult } from "../../core/process-types.ts";
import { md5Hash } from "../../core/hash.ts";
import { resourcePath } from "../../core/resources.ts";
import { pythonExec } from "../../core/jupyter/exec.ts";
import {
  JupyterCapabilities,
  JupyterKernelspec,
} from "../../core/jupyter/types.ts";
import { jupyterCapabilities } from "../../core/jupyter/capabilities.ts";
import {
  jupyterCapabilitiesMessage,
  jupyterInstallationMessage,
  jupyterUnactivatedEnvMessage,
  pythonInstallationMessage,
} from "../../core/jupyter/jupyter-shared.ts";

import {
  kExecuteDaemon,
  kExecuteDaemonRestart,
  kExecuteDebug,
} from "../../config/constants.ts";

import { ExecuteOptions } from "../types.ts";
import { normalizePath } from "../../core/path.ts";

export interface JupyterExecuteOptions extends ExecuteOptions {
  kernelspec: JupyterKernelspec;
  python_cmd: string[];
  supervisor_pid?: number;
}

export async function executeKernelOneshot(
  options: JupyterExecuteOptions,
): Promise<void> {
  // abort any existing keepalive kernel
  await abortKernel(options);

  // execute the notebook (save back in place)
  if (!options.quiet) {
    messageStartingKernel(options.kernelspec);
  }

  trace(options, "Executing notebook with oneshot kernel");
  const debug = !!options.format.execute[kExecuteDebug];
  const result = await execJupyter(
    "execute",
    { ...options, debug },
    options.kernelspec,
  );

  if (!result.success) {
    return Promise.reject();
  }
}

export async function executeKernelKeepalive(
  options: JupyterExecuteOptions,
): Promise<void> {
  // if we are in debug mode then tail follow the log file
  let serverLogProcess: Deno.Process | undefined;
  if (options.format.execute[kExecuteDebug]) {
    if (Deno.build.os !== "windows") {
      serverLogProcess = Deno.run({
        cmd: ["tail", "-F", "-n", "0", kernelLogFile()],
      });
    }
  }

  // if we have a restart request then abort before proceeding
  if (options.format.execute[kExecuteDaemonRestart]) {
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
            if (msg.type === "error") {
              trace(options, "Error response received");
              error(msg.data, { colorize: false });
              printExecDiagnostics(options.kernelspec, msg.data);
              return Promise.reject();
            } else if (msg.type == "restart") {
              trace(options, "Restart request received");
              return executeKernelKeepalive(options);
            } else {
              info(msg.data, { newline: false });
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
      // deno-lint-ignore no-explicit-any
      (serverLogProcess as any).kill("SIGKILL");
    }
  }
}

async function abortKernel(options: JupyterExecuteOptions) {
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

async function execJupyter(
  command: string,
  options: Record<string, unknown>,
  kernelspec: JupyterKernelspec,
): Promise<ProcessResult> {
  try {
    const result = await execProcess(
      {
        cmd: [
          ...(await pythonExec(kernelspec)),
          resourcePath("jupyter/jupyter.py"),
        ],
        env: {
          // Force default matplotlib backend. something simillar is done here:
          // https://github.com/ipython/ipykernel/blob/d7339c2c70115bbe6042880d29eeb273b5a2e350/ipykernel/kernelapp.py#L549-L554
          // however this respects existing environment variables, which we've seen in at least
          // one case result in an inability to render due to the iTerm2 backend being configured
          // (see https://github.com/quarto-dev/quarto-cli/issues/502). Our current position is
          // that the way to use a different backend w/ Quarto is to call the matplotlib.use()
          // function within the notebook
          "MPLBACKEND": "module://matplotlib_inline.backend_inline",
          "PYDEVD_DISABLE_FILE_VALIDATION": "1",
        },
        stdout: "piped",
      },
      kernelCommand(command, "", options),
    );
    if (!result.success) {
      // forward error (print some diagnostics if python and/or jupyter couldn't be found)
      await printExecDiagnostics(kernelspec, result.stderr);
    }
    return result;
  } catch (e) {
    if (e?.message) {
      info("");
      error(e.message);
    }
    await printExecDiagnostics(kernelspec);
    return Promise.reject();
  }
}

export async function printExecDiagnostics(
  kernelspec: JupyterKernelspec,
  stderr?: string,
) {
  const caps = await jupyterCapabilities(kernelspec);
  if (caps && !caps.jupyter_core) {
    info("Python 3 installation:");
    info(await jupyterCapabilitiesMessage(caps, "  "));
    info("");
    info(jupyterInstallationMessage(caps));
    info("");
    maybePrintUnactivatedEnvMessage(caps);
  } else if (caps && !haveRequiredPython(caps)) {
    info(pythonVersionMessage());
    info(await jupyterCapabilitiesMessage(caps, "  "));
  } else if (!caps) {
    info(pythonInstallationMessage());
    info("");
  } else if (stderr && (stderr.indexOf("ModuleNotFoundError") !== -1)) {
    maybePrintUnactivatedEnvMessage(caps);
  }
}

function haveRequiredPython(caps: JupyterCapabilities) {
  return caps.versionMajor >= 3 && caps.versionMinor >= 6;
}

function pythonVersionMessage() {
  return `Quarto requires Python version 3.6 (or greater). Detected version is:`;
}

function maybePrintUnactivatedEnvMessage(caps: JupyterCapabilities) {
  const envMessage = jupyterUnactivatedEnvMessage(caps);
  if (envMessage) {
    info(envMessage);
    info("");
  }
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
  let transportsDir: string;

  try {
    transportsDir = quartoRuntimeDir("jt");
  } catch (e) {
    console.error("Could create runtime directory for jupyter transport.");
    console.error(
      "This is possibly a permission issue in the environment Quarto is running in.",
    );
    console.error(
      "Please consult the following documentation for more information:",
    );
    console.error(
      "https://github.com/quarto-dev/quarto-cli/issues/4594#issuecomment-1619177667",
    );
    throw e;
  }
  const targetFile = normalizePath(target);
  const hash = md5Hash(targetFile).slice(0, 20);
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
        error(
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
  options: JupyterExecuteOptions,
  startIfRequired = true,
): Promise<[Deno.Conn, KernelTransport]> {
  // see if we are in debug mode
  const debug = !!options.format.execute[kExecuteDebug];

  // derive the file path for this connection
  const transportFile = kernelTransportFile(options.target.input);

  // determine connection type -- for now we are going to *always* use tcp because we observed
  // periodic hanging on osx with attempting to connect to domain sockets. note also that we
  // have to fall back to tcp anyway when transportFile path is > 100, see here for details:
  // https://unix.stackexchange.com/questions/367008/why-is-socket-path-length-limited-to-a-hundred-chars
  // note also that the entire preview subsystem requires the ability to bind to tcp ports
  // so this isn't really taking us into new compatibility waters
  /*
  const type = Deno.build.os === "windows" || transportFile.length >= 100
    ? "tcp"
    : "unix";
  */
  const type = "tcp";

  // get the transport
  const transport = readKernelTransportFile(transportFile, type);

  // if there is a transport then try to connect to it
  if (transport) {
    try {
      return await denoConnectToKernel(transport);
    } catch {
      // remove the transport file
      if (existsSync(transportFile)) {
        Deno.removeSync(transportFile);
      }
    }
  }

  // we are done if there is no startIfRequired request
  if (!startIfRequired) {
    return Promise.reject();
  }

  // start the kernel
  if (!options.quiet) {
    messageStartingKernel(options.kernelspec);
  }

  // determine timeout
  const kDefaultTimeout = 300;
  const keepAlive = options.format.execute[kExecuteDaemon];
  const timeout =
    keepAlive === true || keepAlive === null || keepAlive === undefined
      ? kDefaultTimeout
      : keepAlive === false
      ? 0
      : keepAlive;

  // try to start the server
  const result = await execJupyter("start", {
    transport: transportFile,
    timeout,
    type,
    debug,
  }, options.kernelspec);
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
        error("Error connecting to Jupyter kernel: " + e.toString());
        return Promise.reject();
      }
    }
  }

  warning("Unable to start Jupyter kernel for " + options.target.input);
  return Promise.reject();
}

async function denoConnectToKernel(
  transport: KernelTransport,
): Promise<[Deno.Conn, KernelTransport]> {
  if (transport.type === "tcp") {
    const tcpConnectOptions = {
      transport: transport.type,
      hostname: "127.0.0.1",
      port: transport.port as number,
    };
    return [
      await Deno.connect(
        tcpConnectOptions,
      ),
      transport,
    ];
  } else {
    const unixConnectOptions = {
      transport: transport.type,
      path: transport.port as string,
    };
    return [
      await Deno.connect(
        unixConnectOptions,
      ),
      transport,
    ];
  }
}

function messageStartingKernel(kernelspec: JupyterKernelspec) {
  info(`\nStarting ${kernelspec.name} kernel...`, { newline: false });
}

function trace(options: ExecuteOptions, msg: string) {
  if (options.format.execute[kExecuteDebug]) {
    info("- " + msg, { bold: true });
  }
}
