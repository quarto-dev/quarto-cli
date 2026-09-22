/*
 * windows-arm-r-error.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import {
  assert,
  assertEquals,
  assertFalse,
  assertStringIncludes,
  assertThrows,
} from "testing/asserts";
import {
  reportWindowsArmX64RError,
  throwIfX64ROnArm,
  WindowsArmX64RError,
} from "../../src/core/knitr.ts";
import { unitTest } from "../test.ts";

const kNativeArmCrash = -1073741569;
const kArmVmCrash = -1073741819;

unitTest("Windows ARM x64 R recognizes both crash exit codes", async () => {
  for (const exitCode of [kNativeArmCrash, kArmVmCrash]) {
    const armError = assertThrows(
      () => throwIfX64ROnArm(exitCode),
      WindowsArmX64RError,
    );
    assertEquals(armError.exitCode, exitCode);
  }
});

unitTest("Windows ARM x64 R ignores unrelated exit codes", async () => {
  throwIfX64ROnArm(1);
});

unitTest(
  "Windows ARM x64 R reports portable installation guidance",
  async () => {
    const records: string[] = [];
    const armError = new WindowsArmX64RError(kNativeArmCrash);

    assert(reportWindowsArmX64RError(
      armError,
      (...args: [string, ...unknown[]]) => {
        assertEquals(args.length, 1);
        records.push(args[0]);
      },
    ));

    const message = armError.message;
    assertStringIncludes(
      message,
      "https://contributor.r-project.org/windows-arm64/",
    );
    assertStringIncludes(message, "Reinstall your R packages");
    assertStringIncludes(message, "QUARTO_R");
    assertStringIncludes(
      message,
      "https://github.com/rstudio/rstudio/issues/15277",
    );
    assertFalse(
      message.includes(
        "https://blog.r-project.org/2024/04/23/r-on-64-bit-arm-windows/",
      ),
    );

    assertEquals(records.length, armError.diagnosticLines.length);
    for (const record of records) {
      const content = record.endsWith("\n") ? record.slice(0, -1) : record;
      assertFalse(
        content.includes("\n"),
        `Log record contains an embedded newline: ${JSON.stringify(record)}`,
      );
    }

    assertFalse(
      reportWindowsArmX64RError(armError, (message) => records.push(message)),
    );
    assertEquals(records.length, armError.diagnosticLines.length);
  },
);
