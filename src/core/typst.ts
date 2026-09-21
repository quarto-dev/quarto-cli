/*
 * typst.ts
 *
 * Copyright (C) 2022 Posit Software, PBC
 */

import { error, info } from "../deno_ral/log.ts";
import { basename, join } from "../deno_ral/path.ts";
import { existsSync } from "../deno_ral/fs.ts";
import * as colors from "fmt/colors";

import { satisfies } from "semver/mod.ts";

import { execProcess } from "./process.ts";
import { architectureToolsPath } from "./resources.ts";
import { resourcePath } from "./resources.ts";
import { md5HashSync } from "./hash.ts";
import { projectScratchPath } from "../project/project-scratch.ts";

export function typstBinaryPath() {
  return Deno.env.get("QUARTO_TYPST") ||
    architectureToolsPath("typst");
}

export function fontPathsArgs(fontPaths?: string[]) {
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

export function parseTypstFontsOutput(output: string): string[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim().toLowerCase())
    .filter((line) => line.length > 0);
}

const availableFontsMemoryCache = new Map<string, string[]>();

export async function getAvailableTypstFonts(
  fontPaths: string[],
  projectDir?: string,
): Promise<string[]> {
  const cacheKey = md5HashSync(
    [...fontPaths].sort().join("\n"),
  );

  // Check in-memory cache
  const memoryCached = availableFontsMemoryCache.get(cacheKey);
  if (memoryCached) {
    return memoryCached;
  }

  // Check disk cache if project context
  if (projectDir) {
    try {
      const cachePath = projectScratchPath(
        projectDir,
        "typst/available-fonts.json",
      );
      const cacheContent = Deno.readTextFileSync(cachePath);
      const cached = JSON.parse(cacheContent) as {
        fontPathsHash: string;
        fonts: string[];
      };
      if (cached.fontPathsHash === cacheKey) {
        availableFontsMemoryCache.set(cacheKey, cached.fonts);
        return cached.fonts;
      }
    } catch {
      // Cache miss or invalid — will re-query
    }
  }

  // Query typst fonts
  const cmd = [typstBinaryPath(), "fonts"];
  cmd.push(...fontPathsArgs(fontPaths));

  const result = await execProcess({
    cmd: cmd[0],
    args: cmd.slice(1),
    stdout: "piped",
    stderr: "piped",
  });

  if (!result.success || !result.stdout) {
    return [];
  }

  const fonts = parseTypstFontsOutput(result.stdout);

  // Populate caches
  availableFontsMemoryCache.set(cacheKey, fonts);

  if (projectDir) {
    try {
      const cachePath = projectScratchPath(
        projectDir,
        "typst/available-fonts.json",
      );
      Deno.writeTextFileSync(
        cachePath,
        JSON.stringify({ fontPathsHash: cacheKey, fonts }),
      );
    } catch {
      // Non-fatal — in-memory cache still works
    }
  }

  return fonts;
}

export type TypstCompileOptions = {
  quiet?: boolean;
  fontPaths?: string[];
  rootDir?: string;
  packagePath?: string;
  pdfStandard?: string[];
};

export async function typstCompile(
  input: string,
  output: string,
  options: TypstCompileOptions = {},
) {
  const quiet = options.quiet ?? false;
  const fontPaths = options.fontPaths;
  if (!quiet) {
    typstProgress(input, output);
  }
  const cmd = [
    typstBinaryPath(),
    "compile",
  ];
  if (options.rootDir) {
    cmd.push("--root", options.rootDir);
  }
  if (options.packagePath) {
    // Only set --package-path if local/ subdirectory exists (for @local packages)
    const localDir = join(options.packagePath, "local");
    if (existsSync(localDir)) {
      cmd.push("--package-path", options.packagePath);
    }
    // Only set --package-cache-path if preview/ subdirectory exists (for @preview packages)
    const previewDir = join(options.packagePath, "preview");
    if (existsSync(previewDir)) {
      cmd.push("--package-cache-path", options.packagePath);
    }
  }
  if (options.pdfStandard && options.pdfStandard.length > 0) {
    cmd.push("--pdf-standard", options.pdfStandard.join(","));
  }
  cmd.push(
    input,
    ...fontPathsArgs(fontPaths),
    output,
  );
  const result = await execProcess({ cmd: cmd[0], args: cmd.slice(1) });
  if (!quiet && result.success) {
    typstProgressDone();
  }
  return result;
}

export async function typstVersion() {
  const cmd = [typstBinaryPath(), "--version"];
  try {
    const result = await execProcess({
      cmd: cmd[0],
      args: cmd.slice(1),
      stdout: "piped",
      stderr: "piped",
    });
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
