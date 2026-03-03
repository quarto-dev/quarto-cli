/*
 * dart-sass.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */
import { join } from "../deno_ral/path.ts";

import { architectureToolsPath } from "./resources.ts";
import { execProcess } from "./process.ts";
import { ProcessResult } from "./process-types.ts";
import { TempContext } from "./temp.ts";
import { lines } from "./text.ts";
import { debug, info } from "../deno_ral/log.ts";
import { existsSync } from "../deno_ral/fs.ts";
import { warnOnce } from "./log.ts";
import { isWindows } from "../deno_ral/platform.ts";
import { requireQuoting, safeWindowsExec } from "./windows.ts";

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
   * Override the sass executable path.
   * Primarily used for testing with spaced paths.
   */
  sassPath?: string;
}

export async function dartCommand(
  args: string[],
  options?: DartCommandOptions,
) {
  const resolvePath = () => {
    const dartOverrideCmd = Deno.env.get("QUARTO_DART_SASS");
    if (dartOverrideCmd) {
      if (!existsSync(dartOverrideCmd)) {
        warnOnce(
          `Specified QUARTO_DART_SASS does not exist, using built in dart sass.`,
        );
      } else {
        return dartOverrideCmd;
      }
    }

    const command = isWindows ? "sass.bat" : "sass";
    return architectureToolsPath(join("dart-sass", command));
  };
  const sass = options?.sassPath ?? resolvePath();

  // Process result helper (shared by Windows and non-Windows paths)
  const processResult = (result: ProcessResult): string | undefined => {
    if (result.success) {
      if (result.stderr) {
        info(result.stderr);
      }
      return result.stdout;
    } else {
      debug(`[DART path]   : ${sass}`);
      debug(`[DART args]   : ${args.join(" ")}`);
      debug(`[DART stdout] : ${result.stdout}`);
      debug(`[DART stderr] : ${result.stderr}`);

      const errLines = lines(result.stderr || "");
      // truncate the last 2 lines (they include a pointer to the temp file containing
      // all of the concatenated sass, which is more or less incomprehensible for users.
      const errMsg = errLines.slice(0, errLines.length - 2).join("\n");
      throw new Error("Theme file compilation failed:\n\n" + errMsg);
    }
  };

  // On Windows, use safeWindowsExec to handle paths with spaces
  // (e.g., when Quarto is installed in C:\Program Files\)
  // See https://github.com/quarto-dev/quarto-cli/issues/13997
  if (isWindows) {
    const quoted = requireQuoting([sass, ...args]);
    const result = await safeWindowsExec(
      quoted.args[0],
      quoted.args.slice(1),
      (cmd: string[]) => {
        return execProcess({
          cmd: cmd[0],
          args: cmd.slice(1),
          stdout: "piped",
          stderr: "piped",
        });
      },
    );
    return processResult(result);
  }

  // Non-Windows: direct execution
  const result = await execProcess({
    cmd: sass,
    args,
    stdout: "piped",
    stderr: "piped",
  });
  return processResult(result);
}
