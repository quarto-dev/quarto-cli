/*
* jupyter-kernel.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

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

  const conn = await connectToKernel(options);
  try {
    await writeKernelCommand(conn, "execute", options);
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
  } finally {
    conn.close();
  }
}

async function abortKernel(options: ExecuteOptions) {
  // connect to kernel if it exists and send abort command
  let conn: Deno.Conn | undefined;
  try {
    conn = await connectToKernel(options, false);
  } catch {
    //
  }
  if (conn) {
    try {
      await writeKernelCommand(conn, "abort", null);
    } finally {
      conn.close();
    }
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
    kernelCommand(command, options),
  );
}

async function writeKernelCommand(
  conn: Deno.Conn,
  command: string,
  options: unknown,
) {
  await conn.write(
    new TextEncoder().encode(kernelCommand(command, options) + "\n"),
  );
}

function kernelCommand(command: string, options: unknown) {
  return JSON.stringify({ command, options });
}

function kernelTransportFile(options: ExecuteOptions) {
  const transportsDir = systemTempDir("quarto-3B64122B");
  const targetFile = Deno.realPathSync(options.target.input);
  const hasher = createHash("md5");
  hasher.update(targetFile);
  const hash = hasher.toString("hex");
  return join(transportsDir, hash);
}

async function connectToKernel(
  options: ExecuteOptions,
  startIfRequired = true,
): Promise<Deno.Conn> {
  const port = 5555;
  const timeout = options.kernel.keepalive === undefined
    ? 300
    : options.kernel.keepalive;
  try {
    return await Deno.connect({ hostname: "127.0.0.1", port });
  } catch (e) {
    if (!startIfRequired) {
      return Promise.reject();
    }

    if (!options.quiet) {
      messageStartingKernel();
    }

    // if there is an error then try to start the server
    const result = await execJupyter("start", { port, timeout });
    if (!result.success) {
      return Promise.reject();
    }

    for (let i = 0; i < 10; i++) {
      await sleep(i * 200);
      try {
        return await Deno.connect({ hostname: "127.0.0.1", port });
      } catch {
        //
      }
    }

    message("Unable to start Jupyter kernel for " + options.target.input);
    return Promise.reject();
  }
}

function messageStartingKernel() {
  message("Starting Jupyter kernel...");
}
