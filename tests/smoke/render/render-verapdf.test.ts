/*
 * render-verapdf.test.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 *
 * Tests for QUARTO_VERAPDF environment variable override functionality.
 */

import { existsSync } from "../../../src/deno_ral/fs.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { quartoDataDir } from "../../../src/core/appdirs.ts";
import { isWindows } from "../../../src/deno_ral/platform.ts";
import { docs } from "../../utils.ts";
import { printsMessage } from "../../verify.ts";
import { testRender } from "./render.ts";

// Test that QUARTO_VERAPDF override is logged and validation runs correctly
// Uses ua-missing-title.qmd which should produce a validation warning
const input = docs("smoke-all/pdf-standard/ua-missing-title.qmd");

// Point QUARTO_VERAPDF to the installed script to test the override path
const verapdfDir = quartoDataDir("verapdf");
const verapdfScript = isWindows
  ? join(verapdfDir, "verapdf.bat")
  : join(verapdfDir, "verapdf");

testRender(input, "pdf", true, [
  // Verify the QUARTO_VERAPDF override message is logged
  printsMessage({
    level: "INFO",
    regex: /Using QUARTO_VERAPDF:.*verapdf/,
  }),
  // Verify that validation actually ran and caught the missing title
  printsMessage({
    level: "WARN",
    regex: /PDF validation failed for ua-2/,
  }),
], {
  prereq: async () => {
    // Skip if verapdf not installed
    return existsSync(verapdfScript);
  },
  env: {
    QUARTO_VERAPDF: verapdfScript,
  },
});
