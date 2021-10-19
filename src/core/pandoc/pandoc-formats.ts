/*
 * pandoc-formats.ts
 *
 * Copyright (C) 2020 by RStudio, PBC
 *
 */
import { execProcess } from "../process.ts";
import { binaryPath } from "../resources.ts";
import { lines } from "../text.ts";

export async function pandocListFormats() {
  const result = await execProcess({
    cmd: [binaryPath("pandoc"), "--list-output-formats"],
    stdout: "piped",
  });
  if (result.success) {
    return lines(result.stdout!)
      .filter((line) => line.length > 0);
  } else {
    return Promise.reject();
  }
}

export function pandocFormatWith(
  format: string,
  prepend: string,
  append: string,
) {
  const split = splitPandocFormatString(format);
  return `${split.format}${prepend}${split.options}${append}`;
}

export function splitPandocFormatString(format: string) {
  // split out base format from options
  let optionsPos = format.indexOf("-");
  if (optionsPos === -1) {
    optionsPos = format.indexOf("+");
  }
  const base = optionsPos === -1 ? format : format.substr(0, optionsPos);
  const options = optionsPos === -1 ? "" : format.substr(optionsPos);
  return {
    format: base,
    options,
  };
}
