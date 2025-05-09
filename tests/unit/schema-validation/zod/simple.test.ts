/*
* simple.test.ts
*
* Copyright (C) 2025 Posit Software, PBC
*
*/

import { unitTest } from "../../../test.ts";
import { assertThrows } from "testing/asserts";
import { Zod } from "../../../../src/resources/types/zod/schema-types.ts";

unitTest("zod-schema-basic", async () => {
  assertThrows(() => Zod.MathMethods.parse("latex"));
  const result = Zod.MathMethods.parse("katex");
});