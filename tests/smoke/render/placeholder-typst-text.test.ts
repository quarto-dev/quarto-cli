/*
 * placeholder-typst-text.test.ts
 *
 * The `placeholder` shortcode rasterizes its generated SVG to PNG with the
 * bundled Typst binary (#14722). That path only works if Typst renders the
 * dimension label text using its embedded fonts (we pass
 * `--ignore-system-fonts`). This contract test pins that assumption: a
 * labelled SVG must produce a materially larger PNG than a blank one — if
 * Typst silently dropped the text, both would be the same blank rectangle.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { assert } from "testing/asserts";
import { join } from "path";
import { unitTest } from "../../test.ts";
import { typstBinaryPath } from "../../../src/core/typst.ts";

async function renderPng(label: string, dir: string): Promise<Uint8Array> {
  const svg =
    `<svg width="120" height="60" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 60"><rect width="120" height="60" fill="#ddd"/><text x="50%" y="50%" font-family="sans-serif" font-size="12" fill="#000" text-anchor="middle">${label}</text></svg>`;
  await Deno.writeTextFile(join(dir, "in.svg"), svg);
  await Deno.writeTextFile(
    join(dir, "in.typ"),
    `#set page(width: auto, height: auto, margin: 0pt)\n#image("in.svg")\n`,
  );
  const png = join(dir, `${label.trim() || "blank"}.png`);
  const { code } = await new Deno.Command(typstBinaryPath(), {
    args: [
      "compile",
      "--root",
      dir,
      "--format",
      "png",
      "--ppi",
      "96",
      "--ignore-system-fonts",
      join(dir, "in.typ"),
      png,
    ],
  }).output();
  assert(code === 0, "typst compile failed");
  return await Deno.readFile(png);
}

unitTest("placeholder-typst-renders-label-text", async () => {
  const dir = await Deno.makeTempDir();
  try {
    const withText = await renderPng("120 x 60", dir);
    const blank = await renderPng(" ", dir);
    assert(withText[0] === 0x89 && withText[1] === 0x50, "not a PNG");
    // A rendered label yields a materially larger PNG than a blank rect; if
    // Typst silently dropped the text, both would be the same blank rect.
    assert(
      withText.length > blank.length + 100,
      `label did not render: ${withText.length}B vs blank ${blank.length}B`,
    );
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});
