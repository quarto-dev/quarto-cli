/*
 * file.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { existsSync } from "fs/mod.ts";
import { execProcess } from "./process.ts";
import { TextLineStream } from "streams/mod.ts";

export function existsSync1(s: string | URL) {
  // eat all but the first param to work in map, filter, find, etc.
  return existsSync(s);
}

export async function visitLines(
  path: string,
  visitor: (line: string | null, count: number) => boolean,
) {
  if (existsSync(path)) {
    const file = await Deno.open(path, { read: true });
    try {
      const stream = file.readable
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new TextLineStream());

      let count = 0;
      for await (const line of stream) {
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
      try {
        file.close();
      } catch {
        // Swallow error see https://github.com/denoland/deno/issues/15442
      }
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
    // Touch the file by rewriting it
    const contents = await Deno.readFileSync(path);
    await Deno.writeFileSync(path, contents);
  } else {
    await execProcess("touch", {
      args: [path],
    });
  }
}
