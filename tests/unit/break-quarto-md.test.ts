/*
* break-quarto-md.test.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { breakQuartoMd } from "../../src/core/lib/break-quarto-md.ts";
import { asMappedString } from "../../src/core/lib/mapped-text.ts";
import { unitTest } from "../test.ts";
import { assert } from "testing/asserts.ts";

unitTest("break-quarto-md", async () => {
  const qmd = `---
title: foo
---

Some text;

$$
e = mc^2
$$ {#eq-black-scholes}

Some more text;
`;

  const cells = (await breakQuartoMd(asMappedString(qmd), false)).cells;
  assert(cells.length === 4);
  assert(!cells[3].source.value.startsWith("$$"));
});
