/*
 * html-encode.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { assertEquals } from "../../asserts.ts";
import { unitTest } from "../../test.ts";
import { encodeAttributeValue } from "../../../src/core/html.ts";

unitTest("encodeAttributeValue escapes every quote once", async () => {
  assertEquals(
    encodeAttributeValue('_blank" onmouseover="x'),
    "_blank&quot; onmouseover=&quot;x",
  );
  assertEquals(encodeAttributeValue("a & b & c"), "a &amp; b &amp; c");
  assertEquals(encodeAttributeValue("<'>"), "&lt;&#039;&gt;");
});
