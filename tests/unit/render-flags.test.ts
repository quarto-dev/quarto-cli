/*
 * render-flags.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { assertEquals } from "../asserts.ts";
import { parseRenderFlags } from "../../src/command/render/flags.ts";
import { unitTest } from "../test.ts";

unitTest("parseRenderFlags - --math-method=METHOD:URL", async () => {
  const flags = await parseRenderFlags([
    "--math-method=katex:https://example.com/katex/",
  ]);
  assertEquals(flags["math-method"], {
    method: "katex",
    url: "https://example.com/katex/",
  });
});

unitTest("parseRenderFlags - --math-method METHOD", async () => {
  const flags = await parseRenderFlags(["--math-method", "katex", "--toc"]);
  assertEquals(flags["math-method"], { method: "katex" });
  assertEquals(flags.toc, true);
});
