#!/usr/bin/env -S deno run --allow-read
/*
 * check-gha-log.ts
 *
 * Dev-only regression guard for the harness's GitHub Actions log grouping
 * (Phase 2 of dev-docs/ci-test-log-grouping-design.md). Reads a captured run
 * log and mechanically asserts invariants 1–3:
 *
 *   1. No nesting — every `::group::` is closed (`::endgroup::`) before the
 *      next one opens; no group is left open at end of log.
 *   2. Group markers start at column 0 (the runner only parses them there).
 *   3. No HARNESS test's `... FAILED` result line, and no `ERRORS`/`FAILURES`
 *      section header, sits between a `::group::` and its `::endgroup::`
 *      (failure detail must land outside collapsed groups). Non-harness
 *      (direct `Deno.test`) FAILED lines are exempt — invariant 3 is scoped to
 *      harness-registered tests under the lazy-closure policy.
 *
 * A stray `::endgroup::` with no open group is harmless (design invariant 2)
 * and is NOT flagged.
 *
 * Usage:
 *   GITHUB_ACTIONS=true ./run-tests.sh <subset> | tee log.txt
 *   deno run --allow-read tests/tools/check-gha-log.ts log.txt
 *
 * Re-run on every Deno version bump: the reporter's output framing is
 * version-sensitive (see "Spike results" / "Caveat" in the design doc).
 *
 * Copyright (C) 2020-2026 Posit Software, PBC
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
    const isGroupClose = line === kGroupClose;

    // Invariant 2: markers must start at column 0. A marker substring anywhere
    // but the start of the line means the runner would not parse it.
    if (!isGroupOpen && !isGroupClose && kMarkerAnywhere.test(line)) {
      violations.push({
        line: n,
        message: "group marker not at column 0",
        text: raw,
      });
      return;
    }

    if (isGroupOpen) {
      // Invariant 1: no nesting — a group must not open while one is open.
      if (depth > 0) {
        violations.push({
          line: n,
          message:
            `nested ::group:: — group opened at line ${openGroupLine} ` +
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
      // A stray ::endgroup:: at depth 0 is harmless (invariant 2) — don't go
      // negative, don't flag.
      if (depth > 0) depth--;
      return;
    }

    // Invariant 3: failure detail must land outside groups.
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

  // Invariant 1: no group left open at end of log (unload must close it).
  if (depth > 0) {
    violations.push({
      line: lines.length,
      message:
        `group left open at end of log: ${openGroupTitle} ` +
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
    console.log(
      `OK: ${path} — grouping invariants hold ` +
        "(no nesting, markers at column 0, no harness FAILED / ERRORS / " +
        "FAILURES inside a group).",
    );
    Deno.exit(0);
  }
  console.error(
    `FAIL: ${path} — ${violations.length} grouping violation(s):`,
  );
  for (const v of violations) {
    console.error(`  line ${v.line}: ${v.message}`);
    if (v.text) console.error(`    | ${v.text}`);
  }
  Deno.exit(1);
}
