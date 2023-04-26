/*
* typst.ts
*
* Copyright (C) 2022 Posit Software, PBC
*
*/

import { info } from "log/mod.ts";
import { basename, dirname } from "path/mod.ts";
import { execProcess } from "./process.ts";

export async function typstCompile(
  input: string,
  output: string,
  quiet = false,
) {
  if (!quiet) {
    typstProgress(input, output);
  }
  const cmd = ["typst", "compile", input, output];
  const result = await execProcess({ cmd });
  if (!quiet && result.success) {
    typstProgressDone();
  }
  return result;
}

// TODO: this doesn't yet work correclty (typst exits on the first change to the typ file)
// leaving the code here anyway as a foundation for getting it to work later
export async function typstWatch(
  input: string,
  output: string,
  quiet = false,
) {
  if (!quiet) {
    typstProgress(input, output);
  }

  // abort controller
  const controller = new AbortController();

  // setup command
  const cmd = new Deno.Command("typst", {
    args: [input, output, "--watch"],
    cwd: dirname(input),
    stdout: "piped",
    stderr: "piped",
    signal: controller.signal,
  });

  // spawn it
  cmd.spawn();

  // wait for ready
  let allOutput = "";
  const decoder = new TextDecoder();
  for await (const chunk of cmd.stderr) {
    const text = decoder.decode(chunk);
    allOutput += text;
    if (allOutput.includes("compiled successfully")) {
      if (!quiet) {
        typstProgressDone();
      }
      cmd.status.then((status) => {
        console.log(`typst exited with status ${status.code}`);
      });
      break;
    }
  }

  // return the abort controller
  return controller;
}

function typstProgress(input: string, output: string) {
  info(
    `[typst]: Compiling ${basename(input)} to ${basename(output)}...`,
    { newline: false },
  );
}

function typstProgressDone() {
  info("DONE\n");
}
