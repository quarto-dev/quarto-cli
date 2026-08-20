/*
 * schemas.ts
 *
 * The two contracts `quarto dev-call axe` publishes: `findings.json` (what the
 * aggregate stage writes, and what the report, agents and the eventual public
 * command read) and `_axe-baseline.json` (the hand-written ledger of accepted
 * findings).
 *
 * These are Zod rather than plain interfaces for two reasons: the aggregate
 * stage can validate its own output in tests, and a hand-edited baseline is
 * validated on read — a typo'd field name should be an error, not a silently
 * ignored unknown key.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { z } from "zod";

/** Bump in step with any breaking change to `findings.json`'s field shape. */
export const kFindingsVersion = 1;

/**
 * Which signature-normalization scheme produced the signatures in this file.
 *
 * Separate from `kFindingsVersion` on purpose: a normalizer change leaves every
 * field name intact but re-keys every signature, so a baseline written under an
 * older scheme matches nothing. Without this, that is indistinguishable from
 * "you fixed everything and introduced an equal number of new problems", and the
 * ledger's notes — the record of *why* each finding was accepted — quietly stop
 * applying. Bump it whenever `normalizeSelector` or `signatureOf` changes in a
 * way that alters existing signatures.
 *
 * 1 — nth-child stripped; volatile attributes dropped; other attribute values
 *     kept with digit runs wildcarded; trailing instance ids collapsed.
 */
export const kSignatureScheme = 1;

// ---------------------------------------------------------------------------
// findings.json
// ---------------------------------------------------------------------------

export const axeImpactSchema = z.enum([
  "critical",
  "serious",
  "moderate",
  "minor",
]);

export const axeOccurrenceSchema = z.object({
  page: z.string(),
  /** CSS selector of one real instance. */
  target: z.string(),
  /** Excerpt of the offending element. */
  html: z.string(),
  detail: z.string(),
  /** The matrix cells this instance reproduced in, e.g. `1440x900·dark`. */
  cells: z.array(z.string()),
});

export const axeFindingSchema = z.object({
  /** Stable handle: rule + hash of the signature. */
  id: z.string(),
  /** Page-independent root-cause key, and the baseline's join key. */
  signature: z.string(),
  rule: z.string(),
  /** Escalated to the worst impact seen across occurrences. */
  impact: axeImpactSchema,
  /** Full label including success criteria, e.g. `WCAG 2.0 AA 1.4.3`. */
  conformance: z.string(),
  /** Version + level alone, e.g. `WCAG 2.0 AA`, for grouping. */
  standard: z.string(),
  standardRank: z.number(),
  severityRank: z.number(),
  bestPractice: z.boolean(),
  help: z.string(),
  helpUrl: z.string(),
  detail: z.string().nullable(),
  /** The new/known switch: act on `false`. */
  baselined: z.boolean(),
  /**
   * The matching baseline entry's note. Present whenever an entry matched the
   * signature — including when the acceptance did *not* hold (impact
   * escalation, or an occurrence on an unlisted page), because "this was
   * accepted at minor, and it's now serious" is the useful bit.
   */
  baselineNote: z.string().nullable(),
  label: z.enum(["systemic", "localized"]),
  /** Distinct DOM elements affected. */
  instances: z.number(),
  /** Every page it occurred on. */
  pages: z.array(z.string()),
  /** Distinct matrix cells it occurred in. */
  cells: z.number(),
  viewports: z.array(z.string()),
  themes: z.array(z.string()),
  examples: z.array(z.string()),
  occurrences: z.array(axeOccurrenceSchema),
});

export const axeStaleEntrySchema = z.object({
  signature: z.string(),
  id: z.string().nullable(),
  rule: z.string().nullable(),
  pages: z.array(z.string()),
  note: z.string(),
});

export const axeNotOkCellSchema = z.object({
  page: z.string(),
  viewport: z.string(),
  theme: z.string(),
  status: z.string(),
  message: z.string().nullable(),
});

export const axeFindingsSchema = z.object({
  version: z.literal(kFindingsVersion),
  signatureScheme: z.literal(kSignatureScheme),
  generated: z.string(),
  quartoVersion: z.string(),
  /** Provenance: results move with axe upgrades. */
  axeVersion: z.string().nullable(),
  /** Echo of what was scanned, for reproducibility. */
  config: z.object({
    siteDir: z.string(),
    viewports: z.array(z.string()),
    themes: z.array(z.string()),
    pages: z.array(z.string()).nullable(),
    maxPages: z.number().nullable(),
    timeout: z.number(),
    settle: z.number(),
  }),
  /**
   * The pages scanned, as output paths. v1 has no `input`/`title`: source
   * mapping needs Quarto's project index and is deferred to the CLI version.
   */
  pages: z.array(z.object({ output: z.string() })),
  cells: z.object({
    total: z.number(),
    ok: z.number(),
    notOk: z.number(),
  }),
  /** Fail-closed: failures are data, never passes. */
  notOkCells: z.array(axeNotOkCellSchema),
  pagesScanned: z.number(),
  baseline: z.object({
    file: z.string(),
    entries: z.number(),
    stale: z.array(axeStaleEntrySchema),
  }),
  counts: z.object({
    total: z.number(),
    new: z.number(),
    baselined: z.number(),
  }),
  findings: z.array(axeFindingSchema),
});

export type AxeFindings = z.infer<typeof axeFindingsSchema>;
export type AxeFinding = z.infer<typeof axeFindingSchema>;
export type AxeOccurrence = z.infer<typeof axeOccurrenceSchema>;
export type AxeImpact = z.infer<typeof axeImpactSchema>;
export type AxeStaleEntry = z.infer<typeof axeStaleEntrySchema>;
export type AxeNotOkCell = z.infer<typeof axeNotOkCellSchema>;

// ---------------------------------------------------------------------------
// _axe-baseline.json
// ---------------------------------------------------------------------------

/**
 * A baseline entry is a projection of a finding: same field names, same
 * meanings, nothing invented, plus a required `note` saying why it's accepted.
 *
 * `pages` is required even when empty, because the two cases mean very
 * different things and an omission shouldn't silently pick the broader one:
 * `[]` accepts the signature site-wide (right for chrome), while a listed
 * `pages` accepts only those pages and re-alerts if the signature turns up
 * anywhere else.
 */
export const axeBaselineEntrySchema = z.object({
  signature: z.string(),
  pages: z.array(z.string()),
  /** The impact *at acceptance*: escalation past this re-alerts. */
  impact: axeImpactSchema,
  note: z.string(),
  // reviewer context, not read by the scanner
  id: z.string().optional(),
  rule: z.string().optional(),
  conformance: z.string().optional(),
});

export type AxeBaselineEntry = z.infer<typeof axeBaselineEntrySchema>;

/**
 * Fields the tolerant reader ignores rather than rejects: everything a finding
 * carries, so pasting a whole finding out of `findings.json` and adding a
 * `note` works. Anything outside this set is treated as a misspelling.
 */
const kToleratedEntryFields = new Set([
  ...Object.keys(axeFindingSchema.shape),
  ...Object.keys(axeBaselineEntrySchema.shape),
]);

/** Levenshtein distance, for "did you mean" on a misspelled field. */
function editDistance(a: string, b: string): number {
  const rows = Array.from(
    { length: a.length + 1 },
    (_, i) => [i, ...Array(b.length).fill(0)],
  );
  for (let j = 0; j <= b.length; j++) {
    rows[0][j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return rows[a.length][b.length];
}

function didYouMean(key: string): string | undefined {
  let best: string | undefined;
  let bestDistance = Infinity;
  for (const candidate of kToleratedEntryFields) {
    const distance = editDistance(key.toLowerCase(), candidate.toLowerCase());
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  // only suggest when it really looks like a typo rather than a new field
  return bestDistance <= Math.max(1, Math.floor(key.length / 3))
    ? best
    : undefined;
}

/**
 * The baseline as read from disk. Unknown-but-known-shaped keys pass through,
 * so pasting a whole finding out of `findings.json` works.
 */
export const axeBaselineSchema = z.object({
  /**
   * The signature scheme the entries were written against. Optional: a ledger
   * without it is assumed to match the current scheme, which is right for the
   * first one anybody writes. Once present, a mismatch is an error rather than
   * a silent mass-invalidation.
   */
  signatureScheme: z.number().optional(),
  findings: z.array(axeBaselineEntrySchema.passthrough()),
}).passthrough();

export type AxeBaseline = z.infer<typeof axeBaselineSchema>;

/** A single problem with a hand-edited baseline, ready to print. */
export interface AxeBaselineIssue {
  path: string;
  message: string;
}

export type ParsedBaseline =
  | { success: true; baseline: AxeBaseline }
  | { success: false; issues: AxeBaselineIssue[] };

/**
 * Validate a hand-edited baseline, reporting misspelled field names alongside
 * the shape errors they cause.
 *
 * Zod alone isn't enough here. A misspelled `impcat:` is, to a tolerant object
 * schema, an unknown key (ignored) plus a missing `impact` (an error) — so the
 * report says "impact: Required" while the culprit sits in plain sight two
 * characters away. Zod also short-circuits: a `superRefine` on the entry never
 * runs once a required field is missing, so the two checks can't be composed.
 * Running them separately and merging the issues gives the reader both halves.
 */
export function parseBaseline(data: unknown): ParsedBaseline {
  const issues: AxeBaselineIssue[] = [];

  const outer = z.object({
    signatureScheme: z.number().optional(),
    findings: z.array(z.record(z.unknown())),
  }).passthrough().safeParse(data);
  if (!outer.success) {
    return {
      success: false,
      issues: outer.error.issues.map((issue) => ({
        path: issue.path.join(".") || "(root)",
        message: issue.message,
      })),
    };
  }

  if (
    outer.data.signatureScheme !== undefined &&
    outer.data.signatureScheme !== kSignatureScheme
  ) {
    return {
      success: false,
      issues: [{
        path: "signatureScheme",
        message:
          `this baseline was written against signature scheme ${outer.data.signatureScheme}, ` +
          `but this build emits scheme ${kSignatureScheme}. Every entry would read as ` +
          `stale. Re-annotate the entries against the new signatures — the raw ` +
          `selectors are unchanged in each finding's occurrences[].target — then ` +
          `set "signatureScheme": ${kSignatureScheme}.`,
      }],
    };
  }

  outer.data.findings.forEach((entry, index) => {
    for (const key of Object.keys(entry)) {
      if (kToleratedEntryFields.has(key)) {
        continue;
      }
      const suggestion = didYouMean(key);
      issues.push({
        path: `findings[${index}].${key}`,
        message: `unknown field '${key}'` +
          (suggestion ? ` — did you mean '${suggestion}'?` : ""),
      });
    }
    const parsed = axeBaselineEntrySchema.passthrough().safeParse(entry);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        issues.push({
          path: `findings[${index}].${issue.path.join(".")}`,
          message: issue.message,
        });
      }
    }
  });

  if (issues.length) {
    return { success: false, issues };
  }
  return { success: true, baseline: axeBaselineSchema.parse(data) };
}
