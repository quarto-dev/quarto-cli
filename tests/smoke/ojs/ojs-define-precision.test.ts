import { docs, outputForInput } from "../../utils.ts";
import { assert } from "testing/asserts";
import { testRender } from "../render/render.ts";
import { verifyOjsDefine } from "../../verify.ts";

// Test for #13958: ojs_define() rounds numbers incorrectly
// Test across all three execution engines: knitr, jupyter, julia
const engines = ["knitr", "jupyter", "julia"];

for (const engine of engines) {
  const input = docs(`ojs/ojs-define-numeric-precision/with-${engine}.qmd`);
  const output = outputForInput(input, "html");

  testRender(
    input,
    "html",
    false,
    [
      verifyOjsDefine(async (contents) => {
        const numEntry = contents.find((item) => item.name === "num");
        assert(numEntry, "Should find 'num' variable in ojs-define data");
        assert(
          typeof numEntry.value === "number",
          "ojs-define value should be a number"
        );

        // Validate numeric precision (the actual bug test)
        const expected = 0.00008604168504168504;
        const tolerance = 1e-15; // Machine epsilon tolerance

        const diff = Math.abs(numEntry.value - expected);
        assert(
          diff < tolerance,
          `ojs-define value should preserve full precision. Expected ${expected}, got ${numEntry.value}, diff ${diff}`
        );
      }, `ojs_define preserves full numeric precision (${engine})`)(output.outputPath),
    ],
  );
}
