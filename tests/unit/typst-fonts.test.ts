/*
 * typst-fonts.test.ts
 *
 * Unit tests for Typst font enumeration and parsing.
 *
 * Copyright (C) 2025 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assert, assertEquals } from "testing/asserts";
import { join } from "../../src/deno_ral/path.ts";
import { isWindows } from "../../src/deno_ral/platform.ts";
import {
  availableFontsCacheKey,
  getAvailableTypstFonts,
  parseTypstFontsOutput,
} from "../../src/core/typst.ts";
import { resourcePath } from "../../src/core/resources.ts";
import { withTempDir } from "../utils.ts";

unitTest("parseTypstFontsOutput - parses one font per line", async () => {
  const output = "Arial\nDejaVu Sans Mono\nLibertinus Serif\n";
  const result = parseTypstFontsOutput(output);
  assertEquals(result, ["arial", "dejavu sans mono", "libertinus serif"]);
});

unitTest("parseTypstFontsOutput - trims whitespace and blank lines", async () => {
  const output = "  Arial  \n\n  DejaVu Sans  \n  \n";
  const result = parseTypstFontsOutput(output);
  assertEquals(result, ["arial", "dejavu sans"]);
});

unitTest("parseTypstFontsOutput - empty output returns empty array", async () => {
  const result = parseTypstFontsOutput("");
  assertEquals(result, []);
});

unitTest("parseTypstFontsOutput - handles windows line endings", async () => {
  const output = "Arial\r\nTimes New Roman\r\n";
  const result = parseTypstFontsOutput(output);
  assertEquals(result, ["arial", "times new roman"]);
});

unitTest(
  "getAvailableTypstFonts - lists fonts added to an already queried font dir (#14993)",
  async () => {
    const revealFonts = resourcePath(
      "formats/revealjs/reveal/dist/theme/fonts",
    );
    await withTempDir(async (projectDir) => {
      const fontDir = join(projectDir, ".quarto", "typst", "fonts");
      Deno.mkdirSync(fontDir, { recursive: true });

      Deno.copyFileSync(
        join(revealFonts, "league-gothic", "league-gothic.ttf"),
        join(fontDir, "league-gothic.ttf"),
      );
      const before = await getAvailableTypstFonts([fontDir], projectDir);
      assert(before.includes("league gothic"));
      assert(!before.includes("source sans pro"));

      Deno.copyFileSync(
        join(revealFonts, "source-sans-pro", "source-sans-pro-regular.ttf"),
        join(fontDir, "source-sans-pro-regular.ttf"),
      );
      const after = await getAvailableTypstFonts([fontDir], projectDir);
      assert(
        after.includes("source sans pro"),
        "font added to the font dir is missing from the available fonts",
      );
    });
  },
);

unitTest(
  "getAvailableTypstFonts - lists a font added inside a nested family dir (#14993)",
  async () => {
    const revealFonts = resourcePath(
      "formats/revealjs/reveal/dist/theme/fonts",
    );
    await withTempDir(async (projectDir) => {
      const fontDir = join(projectDir, ".quarto", "typst", "fonts");
      const familyDir = join(fontDir, "fonts.gstatic.com", "s", "fam", "v1");
      Deno.mkdirSync(familyDir, { recursive: true });

      Deno.copyFileSync(
        join(revealFonts, "league-gothic", "league-gothic.ttf"),
        join(familyDir, "league-gothic.ttf"),
      );
      const before = await getAvailableTypstFonts([fontDir], projectDir);
      assert(before.includes("league gothic"));
      assert(
        !before.includes("source sans pro"),
        "precondition: source sans pro must not be installed on this host",
      );

      Deno.copyFileSync(
        join(revealFonts, "source-sans-pro", "source-sans-pro-regular.ttf"),
        join(familyDir, "source-sans-pro-regular.ttf"),
      );
      const after = await getAvailableTypstFonts([fontDir], projectDir);
      assert(
        after.includes("source sans pro"),
        "font added to a nested family dir is missing from the available fonts",
      );
    });
  },
);

unitTest(
  "getAvailableTypstFonts - ignores a missing font dir",
  async () => {
    await withTempDir(async (projectDir) => {
      const fonts = await getAvailableTypstFonts(
        [join(projectDir, "does-not-exist")],
        projectDir,
      );
      assert(fonts.includes("libertinus serif"));
    });
  },
);

unitTest(
  "getAvailableTypstFonts - lists fonts added next to a broken entry (#14993)",
  async () => {
    const revealFonts = resourcePath(
      "formats/revealjs/reveal/dist/theme/fonts",
    );
    await withTempDir(async (projectDir) => {
      const fontDir = join(projectDir, ".quarto", "typst", "fonts");
      Deno.mkdirSync(fontDir, { recursive: true });

      Deno.copyFileSync(
        join(revealFonts, "league-gothic", "league-gothic.ttf"),
        join(fontDir, "league-gothic.ttf"),
      );
      try {
        Deno.symlinkSync(
          join(fontDir, "nope.ttf"),
          join(fontDir, "broken.ttf"),
          { type: "file" },
        );
      } catch (e) {
        if (e instanceof Error && e.message.includes("privilege")) {
          console.log("skipped: symlink creation not permitted on this host");
          return;
        }
        throw e;
      }

      const before = await getAvailableTypstFonts([fontDir], projectDir);
      assert(before.includes("league gothic"));
      assert(
        !before.includes("source sans pro"),
        "precondition: source sans pro must not be installed on this host",
      );

      Deno.copyFileSync(
        join(revealFonts, "source-sans-pro", "source-sans-pro-regular.ttf"),
        join(fontDir, "source-sans-pro-regular.ttf"),
      );
      const after = await getAvailableTypstFonts([fontDir], projectDir);
      assert(
        after.includes("source sans pro"),
        "font added next to a broken entry is missing from the available fonts",
      );
    });
  },
);

unitTest(
  "availableFontsCacheKey - changes when a font is added to a TYPST_FONT_PATHS dir (#14993)",
  async () => {
    const revealFonts = resourcePath(
      "formats/revealjs/reveal/dist/theme/fonts",
    );
    await withTempDir(async (dir) => {
      const envA = join(dir, "envA");
      const envB = join(dir, "envB");
      Deno.mkdirSync(envA);
      Deno.mkdirSync(envB);
      Deno.copyFileSync(
        join(revealFonts, "league-gothic", "league-gothic.ttf"),
        join(envA, "league-gothic.ttf"),
      );
      const getEnv = (name: string) =>
        name === "TYPST_FONT_PATHS"
          ? `${envA}${isWindows ? ";" : ":"}${envB}`
          : undefined;

      const before = availableFontsCacheKey([], getEnv);
      Deno.copyFileSync(
        join(revealFonts, "source-sans-pro", "source-sans-pro-regular.ttf"),
        join(envB, "source-sans-pro-regular.ttf"),
      );
      const after = availableFontsCacheKey([], getEnv);

      assert(before !== undefined);
      assert(before !== after);
    });
  },
);
