/*
* file.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { TextProtoReader } from "textproto/mod.ts";
import { BufReader } from "io/mod.ts";
import { exists } from "fs/mod.ts";
import { execProcess } from "./process.ts";

export async function visitLines(
  path: string,
  visitor: (line: string | null, count: number) => boolean,
) {
  if (await exists(path)) {
    const file = await Deno.open(path, { read: true });
    try {
      const reader = new TextProtoReader(BufReader.create(file));

      let count = 0;
      while (true) {
        const line = await reader.readLine();
        if (line !== null) {
          if (!visitor(line, count)) {
            break;
          }
        } else {
          break;
        }
        count += 1;
      }
    } finally {
      file.close();
    }
  }
}

export async function appendTextFile(
  path: string,
  text: string,
) {
  const file = await Deno.open(path, { append: true });
  try {
    const encoder = new TextEncoder();
    file.writeSync(encoder.encode(text));
  } finally {
    file.close();
  }
}

export async function touch(path: string) {
  if (Deno.build.os === "windows") {
    // Touch the file be rewriting it
    const contents = await Deno.readTextFile(path);
    await Deno.writeTextFile(path, contents);
  } else {
    await execProcess({
      cmd: ["touch", path],
    });
  }
}
