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
