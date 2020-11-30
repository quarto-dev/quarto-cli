/*
* console.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import * as colors from "fmt/colors.ts";

export interface MessageOptions {
  newline?: boolean;
  bold?: boolean;
  indent?: number;
}

export function message(line: string, options?: MessageOptions) {
  const { newline = true, bold = false, indent = 0 } = options || {};
  if (indent) {
    const pad = " ".repeat(indent);
    line = line
      .split(/\r?\n/)
      .map((line) => pad + line)
      .join("\n");
  }
  if (bold) {
    line = colors.bold(line);
  }
  Deno.stderr.writeSync(new TextEncoder().encode(line + (newline ? "\n" : "")));
}
export function writeFileToStdout(file: string) {
  const df = Deno.openSync(file, { read: true });
  const contents = Deno.readAllSync(df);
  Deno.writeAllSync(Deno.stdout, contents);
  Deno.close(df.rid);
}
