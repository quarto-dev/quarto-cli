/*
* file.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { TextProtoReader } from "textproto/mod.ts";
import { BufReader } from "io/bufio.ts";

export async function visitLines(
  path: string,
  visitor: (line: string | null, count: number) => boolean,
) {
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
