import { existsSync } from "fs/exists.ts";
import { assert } from "testing/asserts.ts";

import { basename, dirname, extname, join } from "path/mod.ts";

export function verifyAndCleanOutput(
  output: string,
) {
  const outputExists = existsSync(output);
  assert(outputExists, `Missing output: ${output}`);
  if (outputExists) {
    Deno.removeSync(output, { recursive: true });
  }
}

export function verifyNoPath(path: string) {
  const pathExists = existsSync(path);
  assert(!pathExists, `Unexpected directory: ${path}`);
}

interface Output {
  outputPath: string;
  supportPath: string;
}

function outputForInput(input: string, to: string) {
  const dir = dirname(input);
  const stem = basename(input, extname(input));

  const outputExt = to || "html";

  const outputPath = join(dir, `${stem}.${outputExt}`);
  const supportPath = join(dir, `${stem}_files`);

  return {
    outputPath,
    supportPath,
  };
}
