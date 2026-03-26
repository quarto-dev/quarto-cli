/*
 * dart-sass.test.ts
 *
 * Tests for dart-sass functionality.
 * Validates fixes for:
 *   https://github.com/quarto-dev/quarto-cli/issues/13997 (spaced paths)
 *   https://github.com/quarto-dev/quarto-cli/issues/14267 (accented paths)
 *   https://github.com/quarto-dev/quarto-cli/issues/6651  (enterprise .bat blocking)
 *
 * Copyright (C) 2020-2025 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assert } from "testing/asserts";
import { isWindows } from "../../src/deno_ral/platform.ts";
import { join } from "../../src/deno_ral/path.ts";
import { dartCommand, dartSassInstallDir } from "../../src/core/dart-sass.ts";

/**
 * Helper: create a junction to the real dart-sass install dir at `targetDir`.
 * Returns cleanup function to remove the junction.
 */
async function createDartSassJunction(targetDir: string) {
  const sassInstallDir = dartSassInstallDir();
  const result = await new Deno.Command("cmd", {
    args: ["/c", "mklink", "/J", targetDir, sassInstallDir],
  }).output();

  if (!result.success) {
    const stderr = new TextDecoder().decode(result.stderr);
    throw new Error(`Failed to create junction: ${stderr}`);
  }

  return async () => {
    await new Deno.Command("cmd", {
      args: ["/c", "rmdir", targetDir],
    }).output();
  };
}

// Test that dartCommand handles spaced paths on Windows (issue #13997)
// dart.exe is called directly, bypassing sass.bat and its quoting issues.
unitTest(
  "dartCommand - handles spaced paths on Windows (issue #13997)",
  async () => {
    const tempBase = Deno.makeTempDirSync({ prefix: "quarto_test_" });
    const spacedSassDir = join(tempBase, "Program Files", "dart-sass");
    const spacedProjectDir = join(tempBase, "My Project");

    let removeJunction: (() => Promise<void>) | undefined;

    try {
      Deno.mkdirSync(join(tempBase, "Program Files"), { recursive: true });
      Deno.mkdirSync(spacedProjectDir, { recursive: true });

      removeJunction = await createDartSassJunction(spacedSassDir);

      const inputScss = join(spacedProjectDir, "test style.scss");
      const outputCss = join(spacedProjectDir, "test style.css");
      Deno.writeTextFileSync(inputScss, "body { color: red; }");

      const result = await dartCommand([inputScss, outputCss], {
        sassPath: spacedSassDir,
      });

      assert(
        result === undefined || result === "",
        "Sass compile should succeed (no stdout for file-to-file compilation)",
      );
      assert(
        Deno.statSync(outputCss).isFile,
        "Output CSS file should be created",
      );
    } finally {
      try {
        if (removeJunction) await removeJunction();
        await Deno.remove(tempBase, { recursive: true });
      } catch (e) {
        console.debug("Test cleanup failed:", e);
      }
    }
  },
  { ignore: !isWindows },
);

// Test that dartCommand handles accented characters in paths (issue #14267)
// Accented chars in user paths (e.g., C:\Users\Sébastien\) broke when
// dart-sass was invoked through a .bat wrapper with UTF-8/OEM mismatch.
unitTest(
  "dartCommand - handles accented characters in paths (issue #14267)",
  async () => {
    const tempBase = Deno.makeTempDirSync({ prefix: "quarto_test_" });
    const accentedSassDir = join(tempBase, "Sébastien", "dart-sass");
    const accentedProjectDir = join(tempBase, "Sébastien", "project");

    let removeJunction: (() => Promise<void>) | undefined;

    try {
      Deno.mkdirSync(join(tempBase, "Sébastien"), { recursive: true });
      Deno.mkdirSync(accentedProjectDir, { recursive: true });

      removeJunction = await createDartSassJunction(accentedSassDir);

      const inputScss = join(accentedProjectDir, "style.scss");
      const outputCss = join(accentedProjectDir, "style.css");
      Deno.writeTextFileSync(inputScss, "body { color: blue; }");

      const result = await dartCommand([inputScss, outputCss], {
        sassPath: accentedSassDir,
      });

      assert(
        result === undefined || result === "",
        "Sass compile should succeed with accented path",
      );
      assert(
        Deno.statSync(outputCss).isFile,
        "Output CSS file should be created at accented path",
      );
    } finally {
      try {
        if (removeJunction) await removeJunction();
        await Deno.remove(tempBase, { recursive: true });
      } catch (e) {
        console.debug("Test cleanup failed:", e);
      }
    }
  },
  { ignore: !isWindows },
);
