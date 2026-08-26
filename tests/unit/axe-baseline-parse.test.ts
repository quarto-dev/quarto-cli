/*
 * axe-baseline-parse.test.ts
 *
 * Tests reading a hand-edited `_axe-baseline.json`: `parseBaseline` in
 * src/command/dev-call/axe/schemas.ts.
 *
 * The baseline is the one file in this feature a human writes by hand, so its
 * failure modes are ergonomics, not just correctness. Two behaviours are chosen
 * deliberately and pinned here: a whole finding pasted out of `findings.json`
 * validates (that's the intended authoring shortcut), while a misspelled field
 * name is an error rather than a silently ignored unknown key — because
 * ignoring `impcat:` would mean "no impact recorded", which reads as an
 * acceptance at the weakest impact.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assert, assertEquals } from "testing/asserts";
import {
  kFindingsVersion,
  kSignatureScheme,
  parseBaseline,
} from "../../src/command/dev-call/axe/schemas.ts";

const kTrimmedEntry = {
  signature: "aria-allowed-role :: .navbar-toggler",
  pages: [],
  impact: "minor",
  note: "tracked upstream",
};

function issuesFor(data: unknown): string[] {
  const result = parseBaseline(data);
  assert(!result.success, "expected parseBaseline to fail");
  return result.issues.map((issue) => `${issue.path}: ${issue.message}`);
}

unitTest(
  "parseBaseline - accepts the trimmed entry shape",
  // deno-lint-ignore require-await
  async () => {
    const result = parseBaseline({ findings: [kTrimmedEntry] });
    assert(result.success, JSON.stringify(result));
    assertEquals(result.baseline.findings.length, 1);
    assertEquals(result.baseline.findings[0].impact, "minor");
  },
);

unitTest(
  "parseBaseline - accepts an empty ledger",
  // deno-lint-ignore require-await
  async () => {
    const result = parseBaseline({ findings: [] });
    assert(result.success);
  },
);

unitTest(
  "parseBaseline - accepts a whole finding pasted from findings.json",
  // deno-lint-ignore require-await
  async () => {
    // Every field a finding carries, so the authoring shortcut is "copy the
    // finding, add a note" rather than "copy the finding, then delete 16 keys".
    const pasted = {
      id: "image-alt-4468cc",
      signature: "image-alt :: img",
      rule: "image-alt",
      impact: "critical",
      conformance: "WCAG 2.0 A (1.1.1)",
      standard: "WCAG 2.0 A",
      standardRank: 0,
      severityRank: 0,
      bestPractice: false,
      help: "Images must have alternative text",
      helpUrl: "https://dequeuniversity.com/rules/axe/4.10/image-alt",
      detail: "Element does not have an alt attribute",
      baselined: false,
      baselineNote: null,
      label: "systemic",
      instances: 2,
      pages: ["about.html", "index.html"],
      cells: 4,
      viewports: ["1440x900"],
      themes: ["light"],
      examples: ["img"],
      occurrences: [],
      note: "accepted while the upstream fix ships",
    };
    const result = parseBaseline({ findings: [pasted] });
    assert(result.success, JSON.stringify(result));
    assertEquals(result.baseline.findings[0].pages, [
      "about.html",
      "index.html",
    ]);
  },
);

unitTest(
  "parseBaseline - a misspelled field is an error, next to the field it broke",
  // deno-lint-ignore require-await
  async () => {
    const issues = issuesFor({
      findings: [{ ...kTrimmedEntry, impcat: "minor", impact: undefined }],
    });
    // Both halves must be reported: the unknown key names the culprit, and the
    // missing required field says what it cost. One without the other sends the
    // reader looking in the wrong place.
    assert(
      issues.some((issue) => issue.includes("impcat")),
      `expected the typo to be named: ${JSON.stringify(issues)}`,
    );
    assert(
      issues.some((issue) => issue.startsWith("findings.0.impact")),
      `expected the missing field to be named: ${JSON.stringify(issues)}`,
    );
  },
);

unitTest(
  "parseBaseline - an invented field is rejected rather than ignored",
  // deno-lint-ignore require-await
  async () => {
    const issues = issuesFor({
      findings: [{ ...kTrimmedEntry, expiresOn: "2027-01-01" }],
    });
    assert(
      issues.some((issue) => issue.includes("expiresOn")),
      JSON.stringify(issues),
    );
  },
);

unitTest(
  "parseBaseline - pages is required, so scope is never guessed",
  // deno-lint-ignore require-await
  async () => {
    // An omitted `pages` must not default to the broader reading. `[]` means
    // site-wide and has to be written on purpose.
    const { pages: _pages, ...withoutPages } = kTrimmedEntry;
    const issues = issuesFor({ findings: [withoutPages] });
    assert(
      issues.some((issue) => issue.startsWith("findings.0.pages")),
      JSON.stringify(issues),
    );
  },
);

unitTest(
  "parseBaseline - note is required, so every entry says why",
  // deno-lint-ignore require-await
  async () => {
    const { note: _note, ...withoutNote } = kTrimmedEntry;
    const issues = issuesFor({ findings: [withoutNote] });
    assert(
      issues.some((issue) => issue.startsWith("findings.0.note")),
      JSON.stringify(issues),
    );
  },
);

unitTest(
  "parseBaseline - an unknown impact is rejected",
  // deno-lint-ignore require-await
  async () => {
    const issues = issuesFor({
      findings: [{ ...kTrimmedEntry, impact: "catastrophic" }],
    });
    assert(
      issues.some((issue) => issue.startsWith("findings.0.impact")),
      JSON.stringify(issues),
    );
  },
);

unitTest(
  "parseBaseline - a stale signature scheme is a named error, not mass staleness",
  // deno-lint-ignore require-await
  async () => {
    const issues = issuesFor({
      signatureScheme: kSignatureScheme - 1,
      findings: [kTrimmedEntry],
    });
    assertEquals(issues.length, 1, JSON.stringify(issues));
    assert(issues[0].startsWith("signatureScheme:"));
    // The message has to say what to do, since every entry silently ceasing to
    // match looks exactly like "everything was fixed".
    assert(issues[0].includes("occurrences[].target"), issues[0]);
  },
);

unitTest(
  "parseBaseline - a matching signature scheme is accepted",
  // deno-lint-ignore require-await
  async () => {
    const result = parseBaseline({
      signatureScheme: kSignatureScheme,
      findings: [kTrimmedEntry],
    });
    assert(result.success, JSON.stringify(result));
  },
);

unitTest(
  "parseBaseline - a ledger with no scheme is assumed current",
  // deno-lint-ignore require-await
  async () => {
    // The first ledger anyone hand-writes shouldn't need the ceremony.
    const result = parseBaseline({ findings: [kTrimmedEntry] });
    assert(result.success, JSON.stringify(result));
    assertEquals(result.baseline.signatureScheme, undefined);
  },
);

unitTest(
  "parseBaseline - findings must be present",
  // deno-lint-ignore require-await
  async () => {
    const issues = issuesFor({});
    assert(
      issues.some((issue) => issue.startsWith("findings")),
      JSON.stringify(issues),
    );
  },
);

unitTest(
  "parseBaseline - an empty note is an error, not a silent acceptance",
  // deno-lint-ignore require-await
  async () => {
    // Every acceptance records its why. This is also what keeps a future
    // machine-drafted baseline honest: generated entries with empty notes
    // fail until a human writes the reason.
    const issues = issuesFor({
      findings: [{ ...kTrimmedEntry, note: "" }],
    });
    assert(
      issues.some((issue) => issue.includes("why this finding is accepted")),
      issues.join("\n"),
    );
  },
);

unitTest(
  "parseBaseline - a findings-version mismatch explains itself",
  // deno-lint-ignore require-await
  async () => {
    const issues = issuesFor({
      version: kFindingsVersion + 1,
      findings: [kTrimmedEntry],
    });
    assertEquals(issues.length, 1);
    assert(issues[0].startsWith("version:"), issues[0]);
    assert(issues[0].includes("README.md"), issues[0]);
    // matching or absent version parses normally
    assert(
      parseBaseline({ version: kFindingsVersion, findings: [kTrimmedEntry] })
        .success,
    );
  },
);
