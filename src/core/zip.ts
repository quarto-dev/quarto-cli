/*
* zip.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { dirname } from "path/mod.ts";
import { execProcess } from "./process.ts";

export function unzip(file: string) {
  const dir = dirname(file);

  if (file.endsWith("zip")) {
    // It's a zip file
    if (Deno.build.os === "windows") {
      return execProcess(
        {
          cmd: ["powershell", "Expand-Archive", file],
          cwd: dir,
          stdout: "piped",
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
