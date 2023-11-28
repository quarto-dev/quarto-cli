/*
 * typst.ts
 *
 * Copyright (C) 2022 Posit Software, PBC
 */

import { error, info } from "log/mod.ts";
import { basename } from "path/mod.ts";
import * as colors from "fmt/colors.ts";

import { satisfies } from "semver/mod.ts";

import { execProcess } from "./process.ts";
import { architectureToolsPath } from "./resources.ts";
import { resourcePath } from "./resources.ts";

export function typstBinaryPath() {
  return Deno.env.get("QUARTO_TYPST") ||
    architectureToolsPath("typst");
}

function fontPathsArgs(fontPaths?: string[]) {
  // orders matter and fontPathsQuarto should be first for our template to work
  const fontPathsQuarto = ["--font-path", resourcePath("formats/typst/fonts")];
  const fontPathsEnv = Deno.env.get("TYPST_FONT_PATHS");
  let fontExtrasArgs: string[] = [];
  if (fontPaths && fontPaths.length > 0) {
    fontExtrasArgs = fontPaths.map((p) => ["--font-path", p]).flat();
  } else if (fontPathsEnv) {
    // Env var is used only if not specified in config by user
    // to respect Typst behavior where `--font-path` has precedence over env var
    return fontExtrasArgs = ["--font-path", fontPathsEnv];
  }

  return fontPathsQuarto.concat(fontExtrasArgs);
}

export async function typstCompile(
  input: string,
  output: string,
  quiet = false,
  fontPaths?: string[],
) {
  if (!quiet) {
    typstProgress(input, output);
  }
  const cmd = [
    typstBinaryPath(),
    "compile",
    input,
    ...fontPathsArgs(fontPaths),
    output,
  ];
  const result = await execProcess({ cmd });
  if (!quiet && result.success) {
    typstProgressDone();
  }
  return result;
}

export async function typstVersion() {
  const cmd = [typstBinaryPath(), "--version"];
  try {
    const result = await execProcess({ cmd, stdout: "piped", stderr: "piped" });
    if (result.success && result.stdout) {
      const match = result.stdout.trim().match(/^typst (\d+\.\d+\.\d+)/);
      if (match) {
        return match[1];
      } else {
        return undefined;
      }
    } else {
      return undefined;
    }
  } catch {
    return undefined;
  }
}

export async function validateRequiredTypstVersion() {
  // only validate if we have a custom env var
  if (Deno.env.get("QUARTO_TYPST")) {
    const version = await typstVersion();
    if (version) {
      const required = ">=0.8";
      if (!satisfies(version, required)) {
        error(
          "An updated version of the Typst CLI is required for rendering typst documents.\n",
        );
        info(colors.blue(
          `You are running version ${version} and version ${required} is required.\n`,
        ));
        info(colors.blue(
          `Updating Typst: ${
            colors.underline("https://github.com/typst/typst#installation")
          }\n`,
        ));
        throw new Error();
      }
    } else {
      error(
        "You need to install the Typst CLI in order to render typst documents.\n",
      );
      info(colors.blue(
        `Installing Typst: ${
          colors.underline("https://github.com/typst/typst#installation")
        }\n`,
      ));
      throw new Error();
    }
  }
}

// TODO: this doesn't yet work correctly (typst exits on the first change to the typ file)
// leaving the code here anyway as a foundation for getting it to work later
/*
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
  const child = cmd.spawn();

  // wait for ready
  let allOutput = "";
  const decoder = new TextDecoder();
  for await (const chunk of child.stderr) {
    const text = decoder.decode(chunk);
    allOutput += text;
    if (allOutput.includes("compiled successfully")) {
      if (!quiet) {
        typstProgressDone();
      }
      child.status.then((status) => {
        console.log(`typst exited with status ${status.code}`);
      });
      break;
    }
  }

  // return the abort controller
  return controller;
}
*/

function typstProgress(input: string, output: string) {
  info(
    `[typst]: Compiling ${basename(input)} to ${basename(output)}...`,
    { newline: false },
  );
}

function typstProgressDone() {
  info("DONE\n");
}
