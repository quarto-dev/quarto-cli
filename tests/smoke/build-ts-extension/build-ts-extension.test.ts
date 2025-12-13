import { noErrorsOrWarnings } from "../../verify.ts";
import { testQuartoCmd, Verify } from "../../test.ts";
import { assert } from "testing/asserts";
import { existsSync } from "../../../src/deno_ral/fs.ts";

const verifyBundleCreated: Verify = {
  name: "Verify bundled JS file was created",
  verify: async () => {
    const bundlePath = "_extensions/test-engine/test-engine.js";
    assert(
      existsSync(bundlePath),
      `Expected bundled file not found: ${bundlePath}`,
    );
  },
};

const verifyImportBundled: Verify = {
  name: "Verify import from import map was bundled",
  verify: async () => {
    const bundlePath = "_extensions/test-engine/test-engine.js";
    const content = Deno.readTextFileSync(bundlePath);

    // Check that the file is substantial (contains bundled dependencies, not just source)
    assert(
      content.length > 1000,
      `Bundle file seems too small (${content.length} bytes), dependencies may not be bundled`,
    );

    // Check that extname function declaration is in the bundle (lightweight check)
    assert(
      content.includes("function extname"),
      "Bundle does not contain 'function extname' - import may not have been bundled",
    );
  },
};

testQuartoCmd(
  "call",
  ["build-ts-extension"],
  [
    noErrorsOrWarnings,
    verifyBundleCreated,
    verifyImportBundled,
  ],
  {
    cwd: () => "smoke/build-ts-extension",
  },
  "build-ts-extension creates bundled engine",
);
