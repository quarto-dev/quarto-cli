import { assert } from "testing/asserts";
import { execProcess } from "../../../src/core/process.ts";
import { quartoDevCmd } from "../../utils.ts";
import { unitTest } from "../../test.ts";

const testPassthroughCmd = (name: string, command: string, args: string[]) => {
  unitTest(name, async () => {
    const result = await execProcess({
      cmd: [
        quartoDevCmd(),
        command,
        ...args,
      ]
    });
    assert(result.success);
  });
}

// Check Pandoc passthrough
testPassthroughCmd("passthrough-pandoc", "pandoc", ["--version"]);
// Check Typst passthrough
testPassthroughCmd("passthrough-typst", "typst", ["--version"]);