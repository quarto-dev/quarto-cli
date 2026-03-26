/*
 * dart-sass.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */
import { join } from "../deno_ral/path.ts";

import { architectureToolsPath } from "./resources.ts";
import { execProcess } from "./process.ts";
import { TempContext } from "./temp.ts";
import { lines } from "./text.ts";
import { debug, info } from "../deno_ral/log.ts";
import { existsSync } from "../deno_ral/fs.ts";
import { warnOnce } from "./log.ts";
import { isWindows } from "../deno_ral/platform.ts";

export function dartSassInstallDir() {
  return architectureToolsPath("dart-sass");
}

export async function dartSassVersion() {
  return await dartCommand(["--version"]);
}

export async function dartCompile(
  input: string,
  outputFilePath: string,
  temp: TempContext,
  loadPaths?: string[],
  compressed?: boolean,
): Promise<string | undefined> {
  // Write the scss to a file
  // We were previously passing it via stdin, but that can be overflowed
  const inputFilePath = temp.createFile({ suffix: ".scss" });

  // Write the css itself to a file
  Deno.writeTextFileSync(inputFilePath, input);
  const args = [
    inputFilePath,
    outputFilePath,
    "--style",
    compressed ? "compressed" : "expanded",
    "--quiet", // Remove this flag to get depedency warnings from SASS
  ];

  if (loadPaths) {
    loadPaths.forEach((loadPath) => {
      args.push(`--load-path=${loadPath}`);
    });
  }

  await dartCommand(args);
  return outputFilePath;
}

/**
 * Options for dartCommand
 */
export interface DartCommandOptions {
  /**
   * Override the dart-sass install directory.
   * Used for testing with non-standard paths (spaces, accented characters).
   */
  installDir?: string;
}

/**
 * Resolve the dart-sass command and its base arguments.
 *
 * On Windows, calls dart.exe + sass.snapshot directly to avoid .bat file
 * issues: Deno quoting bugs (#13997), cmd.exe encoding (#14267), and
 * enterprise .bat blocking (#6651).
 */
function resolveSassCommand(options?: DartCommandOptions): {
  cmd: string;
  baseArgs: string[];
} {
  const installDir = options?.installDir;
  if (!installDir) {
    const dartOverrideCmd = Deno.env.get("QUARTO_DART_SASS");
    if (dartOverrideCmd) {
      if (!existsSync(dartOverrideCmd)) {
        warnOnce(
          `Specified QUARTO_DART_SASS does not exist, using built in dart sass.`,
        );
      } else {
        return { cmd: dartOverrideCmd, baseArgs: [] };
      }
    }
  }

  const sassDir = installDir ?? architectureToolsPath("dart-sass");

  if (isWindows) {
    return {
      cmd: join(sassDir, "src", "dart.exe"),
      baseArgs: [join(sassDir, "src", "sass.snapshot")],
    };
  }

  return { cmd: join(sassDir, "sass"), baseArgs: [] };
}

export async function dartCommand(
  args: string[],
  options?: DartCommandOptions,
) {
  const { cmd, baseArgs } = resolveSassCommand(options);

  const result = await execProcess({
    cmd,
    args: [...baseArgs, ...args],
    stdout: "piped",
    stderr: "piped",
  });

  if (result.success) {
    if (result.stderr) {
      info(result.stderr);
    }
    return result.stdout;
  } else {
    debug(`[DART cmd]    : ${cmd}`);
    debug(`[DART args]   : ${[...baseArgs, ...args].join(" ")}`);
    debug(`[DART stdout] : ${result.stdout}`);
    debug(`[DART stderr] : ${result.stderr}`);

    const errLines = lines(result.stderr || "");
    // truncate the last 2 lines (they include a pointer to the temp file containing
    // all of the concatenated sass, which is more or less incomprehensible for users.
    const errMsg = errLines.slice(0, errLines.length - 2).join("\n");
    throw new Error("Theme file compilation failed:\n\n" + errMsg);
  }
}
