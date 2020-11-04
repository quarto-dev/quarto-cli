import { existsSync } from "fs/exists.ts";
import { assert } from "testing/asserts.ts";

export function verifyAndCleanOutput(
  output: string,
) {
  const outputExists = existsSync(output);
  assert(outputExists, "Failed to create output at expected location");
  if (outputExists) {
    Deno.removeSync(output, { recursive: true });
  }
}
