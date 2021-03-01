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
  dim?: boolean;
  format?: (line: string) => string;
  indent?: number;
}

export function message(line: string, options?: MessageOptions) {
  const {
    newline = true,
    bold = false,
    dim = false,
    format = undefined,
    indent = 0,
  } = options ||
    {} as MessageOptions;
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
  if (dim) {
    line = colors.dim(line);
  }
  if (format) {
    line = format(line);
  }
  Deno.stderr.writeSync(new TextEncoder().encode(line + (newline ? "\n" : "")));
}

export function messageFormatData(data: Uint8Array, options?: MessageOptions) {
  const decoder = new TextDecoder("utf8");
  const encoder = new TextEncoder();

  const { newline = true, bold = false, indent = 0 } = options || {};
  let output = decoder.decode(data);
  if (indent) {
    const pad = " ".repeat(indent);
    output = output
      .split(/\r?\n/)
      .map((output) => pad + output)
      .join("\n");
  }
  if (bold) {
    output = colors.bold(output);
  }

  Deno.stderr.writeSync(encoder.encode(output + (newline ? "\n" : "")));
}

export function formatLine(values: string[], lengths: number[]) {
  const line: string[] = [];
  values.forEach((value, i) => {
    const len = lengths[i];
    if (value.length === len) {
      line.push(value);
    } else if (value.length > len) {
      line.push(value.substr(0, len));
    } else {
      line.push(value.padEnd(len, " "));
    }
  });
  return line.join("");
}

export function writeFileToStdout(file: string) {
  const df = Deno.openSync(file, { read: true });
  const contents = Deno.readAllSync(df);
  Deno.writeAllSync(Deno.stdout, contents);
  Deno.close(df.rid);
}
