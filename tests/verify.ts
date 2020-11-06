import { existsSync } from "fs/exists.ts";
import { assert } from "testing/asserts.ts";

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
  assert(!pathExists, `Missing directory: ${path}`);
}
