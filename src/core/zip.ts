/*
 * zip.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */
import { dirname } from "../deno_ral/path.ts";
import { existsSync } from "../deno_ral/fs.ts";
import { isWindows } from "../deno_ral/platform.ts";
import { execProcess } from "./process.ts";
import { safeWindowsExec } from "./windows.ts";

export function unzip(file: string, dir?: string) {
  if (!dir) dir = dirname(file);

  if (file.endsWith("zip")) {
    // It's a zip file
    if (isWindows) {
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
              cmd: cmd[0],
              args: cmd.slice(1),
              stdout: "piped",
            },
          );
        },
      );
    } else {
      // Use the built in unzip command
      return execProcess(
        { cmd: "unzip", args: ["-o", file], cwd: dir, stdout: "piped" },
      );
    }
  } else {
    // use the tar command to untar this
    // On Windows, prefer System32 tar to avoid Git Bash tar path issues
    let tarCmd = "tar";
    if (isWindows) {
      const systemRoot = Deno.env.get("SystemRoot") || "C:\\Windows";
      const system32Tar = `${systemRoot}\\System32\\tar.exe`;
      if (existsSync(system32Tar)) {
        tarCmd = system32Tar;
      }
      // Otherwise fall back to "tar" in PATH
    }
    return execProcess(
      { cmd: tarCmd, args: ["xfz", file], cwd: dir, stdout: "piped" },
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
    if (isWindows) {
      return [
        "PowerShell",
        "Compress-Archive",
        "-Path",
        filesArr.map((x) => `"${x}"`).join(", "),
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

  const cmd = zipCmd();
  return execProcess({
    cmd: cmd[0],
    args: cmd.slice(1),
    cwd: options?.cwd,
    stdout: "piped",
    stderr: "piped",
  });
}
