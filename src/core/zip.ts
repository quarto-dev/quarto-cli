/*
 * zip.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */
import { dirname } from "../deno_ral/path.ts";
import { existsSync } from "fs/mod.ts";
import { isWindows } from "./platform.ts";
import { execProcess } from "./process.ts";
import { safeWindowsExec } from "./windows.ts";

export function unzip(file: string) {
  const dir = dirname(file);

  if (file.endsWith("zip")) {
    // It's a zip file
    if (isWindows()) {
      const args = [
        "-Command",
        `"& { Add-Type -A 'System.IO.Compression.FileSystem'; [IO.Compression.ZipFile]::ExtractToDirectory('${file}', '${dir}'); }"`,
      ];
      return safeWindowsExec(
        "powershell",
        args,
        (cmd: string[]) => {
          return execProcess(
            {
              cmd: cmd,
              stdout: "piped",
            },
          );
        },
      );
    } else {
      // Use the built in unzip command
      return execProcess(
        { cmd: ["unzip", "-o", file], cwd: dir, stdout: "piped" },
      );
    }
  } else {
    // use the tar command to untar this
    return execProcess(
      { cmd: ["tar", "xfz", file], cwd: dir, stdout: "piped" },
    );
  }
}

export function zip(
  files: string | string[],
  archive: string,
  options?: {
    overwrite?: boolean;
    cwd?: string;
  },
) {
  if (options?.overwrite === false && existsSync(archive)) {
    throw new Error(`An archive already exits at ${archive}`);
  }

  const filesArr = Array.isArray(files) ? files : [files];

  const zipCmd = () => {
    if (Deno.build.os === "windows") {
      return [
        "PowerShell",
        "Compress-Archive",
        "-Path",
        filesArr.join(", "),
        "-DestinationPath",
        archive,
        "-Force",
      ];
    } else {
      return [
        "zip",
        "-r",
        archive,
        ...filesArr,
      ];
    }
  };
  return execProcess({
    cmd: zipCmd(),
    cwd: options?.cwd,
    stdout: "piped",
    stderr: "piped",
  });
}
