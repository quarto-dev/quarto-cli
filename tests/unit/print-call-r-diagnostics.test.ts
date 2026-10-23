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
import { assert, assertEquals, assertFalse } from "testing/asserts";
import { printCallRDiagnostics } from "../../src/execute/rmd.ts";
import { WindowsArmX64RError } from "../../src/core/knitr.ts";

unitTest(
  "printCallRDiagnostics - swallows a throw from R discovery",
  async () => {
    let threw = false;
    try {
      await printCallRDiagnostics({
        checkRBinary: () => {
          throw new Error("boom from checkRBinary");
        },
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

unitTest(
  "printCallRDiagnostics - reports Windows ARM error without masking failure",
  async () => {
    const armError = new WindowsArmX64RError(-1073741819);
    const records: Array<{ level: string; message: string }> = [];
    let threw = false;

    try {
      await printCallRDiagnostics({
        checkRBinary: async () => "Rscript",
        knitrCapabilities: async () => {
          throw armError;
        },
        reportWindowsArmX64RError: (error) => {
          error.diagnosticLines.forEach((message) => {
            records.push({ level: "ERROR", message });
          });
          return true;
        },
        info: (message) => {
          records.push({ level: "INFO", message });
        },
        warning: (message) => {
          records.push({ level: "WARN", message });
        },
      });
    } catch {
      threw = true;
    }

    assertFalse(
      threw,
      "Windows ARM diagnostics should not replace the original render failure",
    );
    assertEquals(
      records,
      armError.diagnosticLines.map((message) => ({
        level: "ERROR",
        message,
      })),
    );
    assert(
      records.every(({ message }) =>
        !message.includes("Please check your installation of R")
      ),
    );
  },
);
