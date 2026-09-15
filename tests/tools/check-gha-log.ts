#!/usr/bin/env -S deno run --allow-read
/*
 * check-gha-log.ts
 *
 * Checks captured GitHub Actions logs for harness grouping violations:
 *
 *   1. Groups are balanced and do not nest.
 *   2. Workflow command markers start at column 0.
 *   3. Harness `FAILED` lines and final failure sections remain ungrouped.
 *
 * Usage:
 *   GITHUB_ACTIONS=true ./run-tests.sh <subset> | tee log.txt
 *   deno run --allow-read tests/tools/check-gha-log.ts log.txt
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { stripAnsi } from "../../src/tools/github.ts";

export interface Violation {
  line: number;
  message: string;
  text: string;
}

const kGroupOpen = "::group::";
const kGroupClose = "::endgroup::";
// A harness test name is `[smoke] > ...` / `[unit] > ...` (see test() in
// tests/test.ts); Deno prints its result as `<name> ... FAILED (<dur>)`.
const kHarnessFailed = /^\[(smoke|unit)\] > .* \.\.\. FAILED/;
const kSectionHeader = /^(ERRORS|FAILURES)$/;
const kMarkerAnywhere = /::(group|endgroup)::/;

export function checkLog(content: string): Violation[] {
  const violations: Violation[] = [];
  const lines = content.split("\n");

  let depth = 0;
  let openGroupLine = 0;
  let openGroupTitle = "";

  lines.forEach((raw, i) => {
    const n = i + 1;
    const line = stripAnsi(raw).replace(/\r$/, "");

    const isGroupOpen = line.startsWith(kGroupOpen);
    // The runner accepts trailing whitespace on a close marker.
    const isGroupClose = line.trimEnd() === kGroupClose;

    // Indented markers are visible text, not workflow commands.
    if (!isGroupOpen && !isGroupClose && kMarkerAnywhere.test(line)) {
      violations.push({
        line: n,
        message: "group marker not at column 0",
        text: raw,
      });
      return;
    }

    if (isGroupOpen) {
      if (depth > 0) {
        violations.push({
          line: n,
          message: `nested ::group:: — group opened at line ${openGroupLine} ` +
            `(${openGroupTitle}) was not closed first`,
          text: raw,
        });
      }
      depth++;
      openGroupLine = n;
      openGroupTitle = line.slice(kGroupOpen.length);
      return;
    }

    if (isGroupClose) {
      // A stray close marker is harmless.
      if (depth > 0) depth--;
      return;
    }

    if (depth > 0) {
      if (kHarnessFailed.test(line)) {
        violations.push({
          line: n,
          message:
            `harness FAILED result line inside group ${openGroupTitle} ` +
            `(opened at line ${openGroupLine})`,
          text: raw,
        });
      } else if (kSectionHeader.test(line.trim())) {
        violations.push({
          line: n,
          message:
            `${line.trim()} section header inside group ${openGroupTitle} ` +
            `(opened at line ${openGroupLine})`,
          text: raw,
        });
      }
    }
  });

  if (depth > 0) {
    violations.push({
      line: lines.length,
      message: `group left open at end of log: ${openGroupTitle} ` +
        `(opened at line ${openGroupLine})`,
      text: "",
    });
  }

  return violations;
}

if (import.meta.main) {
  const path = Deno.args[0];
  if (!path) {
    console.error("usage: check-gha-log.ts <log-file>");
    Deno.exit(2);
  }
  const content = Deno.readTextFileSync(path);
  const violations = checkLog(content);
  if (violations.length === 0) {
    console.log(`OK: ${path} has valid GitHub Actions grouping.`);
    Deno.exit(0);
  }
  console.error(
    `FAIL: ${path} has ${violations.length} grouping violation(s):`,
  );
  for (const v of violations) {
    console.error(`  line ${v.line}: ${v.message}`);
    if (v.text) console.error(`    | ${v.text}`);
  }
  Deno.exit(1);
}
