/*
 * print-call-r-diagnostics.test.ts
 *
 * Tests that a failure while gathering R diagnostics (e.g. checkRBinary
 * throwing) never masks the original callR error.
 * See https://github.com/quarto-dev/quarto-cli/issues/14775
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assert } from "testing/asserts";
import { printCallRDiagnostics } from "../../src/execute/rmd.ts";

unitTest(
  "printCallRDiagnostics - swallows a throw from R discovery",
  async () => {
    let threw = false;
    try {
      await printCallRDiagnostics(() => {
        throw new Error("boom from checkRBinary");
      });
    } catch {
      threw = true;
    }
    assert(
      !threw,
      "printCallRDiagnostics should not propagate a failure from R discovery",
    );
  },
);
