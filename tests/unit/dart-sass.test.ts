/*
 * dart-sass.test.ts
 *
 * Tests for dart-sass functionality.
 * Validates fix for https://github.com/quarto-dev/quarto-cli/issues/13997
 *
 * Copyright (C) 2020-2025 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assert } from "testing/asserts";
import { isWindows } from "../../src/deno_ral/platform.ts";
import { join } from "../../src/deno_ral/path.ts";
import { dartCommand, dartSassInstallDir } from "../../src/core/dart-sass.ts";

// Test that dartCommand handles spaced paths on Windows (issue #13997)
// The bug only triggers when BOTH the executable path AND arguments contain spaces.
unitTest(
  "dartCommand - handles spaced paths on Windows (issue #13997)",
  async () => {
    // Create directories with spaces for both sass and file arguments
    const tempBase = Deno.makeTempDirSync({ prefix: "quarto_test_" });
    const spacedSassDir = join(tempBase, "Program Files", "dart-sass");
    const spacedProjectDir = join(tempBase, "My Project");
    const sassInstallDir = dartSassInstallDir();

    try {
      // Create directories
      Deno.mkdirSync(join(tempBase, "Program Files"), { recursive: true });
      Deno.mkdirSync(spacedProjectDir, { recursive: true });

      // Create junction (Windows directory symlink) to actual dart-sass
      const junctionResult = await new Deno.Command("cmd", {
        args: ["/c", "mklink", "/J", spacedSassDir, sassInstallDir],
      }).output();

      if (!junctionResult.success) {
        const stderr = new TextDecoder().decode(junctionResult.stderr);
        throw new Error(`Failed to create junction: ${stderr}`);
      }

      // Create test SCSS file in spaced path (args with spaces)
      const inputScss = join(spacedProjectDir, "test style.scss");
      const outputCss = join(spacedProjectDir, "test style.css");
      Deno.writeTextFileSync(inputScss, "body { color: red; }");

      const spacedSassPath = join(spacedSassDir, "sass.bat");

      // This is the exact bug scenario: spaced exe path + spaced args
      // Without the fix, this fails with "C:\...\Program" not recognized
      const result = await dartCommand([inputScss, outputCss], {
        sassPath: spacedSassPath,
      });

      // Verify compilation succeeded (no stdout expected for file-to-file compilation)
      assert(
        result === undefined || result === "",
        "Sass compile should succeed (no stdout for file-to-file compilation)",
      );
      assert(
        Deno.statSync(outputCss).isFile,
        "Output CSS file should be created",
      );
    } finally {
      // Cleanup: remove junction first (rmdir for junctions), then temp directory
      try {
        await new Deno.Command("cmd", {
          args: ["/c", "rmdir", spacedSassDir],
        }).output();
        await Deno.remove(tempBase, { recursive: true });
      } catch (e) {
        // Best effort cleanup - log for debugging if it fails
        console.debug("Test cleanup failed:", e);
      }
    }
  },
  { ignore: !isWindows },
);
