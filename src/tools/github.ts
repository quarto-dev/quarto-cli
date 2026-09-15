/*
 * github.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { GitHubRelease } from "./types.ts";

// deno-lint-ignore-file camelcase

// GitHub Actions Detection
export function isGitHubActions(): boolean {
  return Deno.env.get("GITHUB_ACTIONS") === "true";
}

export function isVerboseMode(): boolean {
  return Deno.env.get("RUNNER_DEBUG") === "1" ||
    Deno.env.get("QUARTO_TEST_VERBOSE") === "true";
}

// GitHub Actions Workflow Command Escaping
// See: https://docs.github.com/en/actions/reference/workflow-commands-for-github-actions
export function escapeData(s: string): string {
  return s
    .replace(/%/g, "%25")
    .replace(/\r/g, "%0D")
    .replace(/\n/g, "%0A");
}

export function escapeProperty(s: string): string {
  return s
    .replace(/%/g, "%25")
    .replace(/\r/g, "%0D")
    .replace(/\n/g, "%0A")
    .replace(/:/g, "%3A")
    .replace(/,/g, "%2C");
}

// GitHub Actions Annotations
export interface AnnotationProperties {
  file?: string;
  line?: number;
  endLine?: number;
  title?: string;
}

function formatProperties(props: AnnotationProperties): string {
  const parts: string[] = [];
  if (props.file !== undefined) {
    parts.push(`file=${escapeProperty(props.file)}`);
  }
  if (props.line !== undefined) parts.push(`line=${props.line}`);
  if (props.endLine !== undefined) parts.push(`endLine=${props.endLine}`);
  if (props.title !== undefined) {
    parts.push(`title=${escapeProperty(props.title)}`);
  }
  return parts.length > 0 ? " " + parts.join(",") : "";
}

export function error(
  message: string,
  properties?: AnnotationProperties,
): void {
  if (!isGitHubActions()) {
    console.log(message);
    return;
  }
  const props = properties ? formatProperties(properties) : "";
  console.log(`::error${props}::${escapeData(message)}`);
}

export function warning(
  message: string,
  properties?: AnnotationProperties,
): void {
  if (!isGitHubActions()) {
    console.log(message);
    return;
  }
  const props = properties ? formatProperties(properties) : "";
  console.log(`::warning${props}::${escapeData(message)}`);
}

export function notice(
  message: string,
  properties?: AnnotationProperties,
): void {
  if (!isGitHubActions()) {
    console.log(message);
    return;
  }
  const props = properties ? formatProperties(properties) : "";
  console.log(`::notice${props}::${escapeData(message)}`);
}

// GitHub Actions Log Grouping
export function startGroup(title: string): void {
  if (!isGitHubActions()) return;
  console.log(`::group::${escapeData(title)}`);
}

export function endGroup(): void {
  if (!isGitHubActions()) return;
  console.log("::endgroup::");
}

export function withGroup<T>(title: string, fn: () => T): T {
  if (!isGitHubActions()) {
    console.log(title);
    return fn();
  }
  startGroup(title);
  try {
    return fn();
  } finally {
    endGroup();
  }
}

export async function withGroupAsync<T>(
  title: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (!isGitHubActions()) {
    console.log(title);
    return await fn();
  }
  startGroup(title);
  try {
    return await fn();
  } finally {
    endGroup();
  }
}

// Legacy group function for backward compatibility and alia
export async function group<T>(
  title: string,
  fn: () => Promise<T>,
): Promise<T> {
  return await withGroupAsync(title, fn);
}

// GitHub Actions failure reporting (used by the test harness — see
// dev-docs/ci-test-log-grouping-design.md). All of these are pure helpers or
// gate on GITHUB_ACTIONS so callers stay byte-identical off CI.

// Strip ANSI escape sequences. Annotation messages and step-summary content
// do NOT render ANSI (only group bodies in the log viewer do), so color codes
// must be removed before embedding captured output in either.
// deno-lint-ignore no-control-regex
const kAnsiPattern = /\x1b\[[0-9;?]*[A-Za-z]/g;
export function stripAnsi(s: string): string {
  return s.replace(kAnsiPattern, "");
}

// The harness emits per-test ::error annotations only when it owns the
// workflow step: on CI and when no outer orchestrator has claimed the step
// via QUARTO_TESTS_GHA_ORCHESTRATED (the bucket-loop YAML sets it and emits
// its own per-file ::error). Arguments default to the live environment;
// unit tests pass them explicitly to avoid mutating process-global env.
// `orchestrated` semantics: omitted → read QUARTO_TESTS_GHA_ORCHESTRATED
// from the live environment; `null` → treat as unset. Tests must pass `null`
// (never an explicit `undefined`, which triggers the default parameter and
// reads the real env — inside a CI bucket step that variable IS set, so the
// test would flip depending on where it runs).
export function harnessOwnsStep(
  githubActions: boolean = isGitHubActions(),
  orchestrated?: string | null,
): boolean {
  const o = orchestrated === undefined
    ? Deno.env.get("QUARTO_TESTS_GHA_ORCHESTRATED")
    : orchestrated;
  return githubActions && !o;
}

// GitHub caps annotations at 10 ::error per workflow STEP; excess is silently
// dropped. One `deno test` process is the step in the harness-owned path, BUT
// Deno instantiates each test file's module graph separately (verified on the
// pinned 2.7.14: module state does not carry across test files, and `unload`
// fires once per file), so a module-level counter would be a per-FILE budget.
// The count is therefore coordinated through a sidecar counter file derived
// from GITHUB_STEP_SUMMARY — unique per step and in a runner-writable
// directory. No locking: without `deno test --parallel`, test files run
// strictly sequentially. With no counter path (not on CI), state falls back
// to instance-local, which unit tests also use via injection.
export function defaultAnnotationCounterPath(): string | undefined {
  const summary = Deno.env.get("GITHUB_STEP_SUMMARY");
  return summary ? `${summary}.qt-annotation-count` : undefined;
}

export interface AnnotationDecision {
  // step-wide 1-based count of this failure (every CI failure gets one, used
  // to build its navigation label; see failureLabel)
  ordinal: number;
  // emit the per-test ::error for this failure
  emitAnnotation: boolean;
  // this failure is the first one past the cap: emit the single aggregate
  // ::error (the 10th and last annotation for the step) instead
  emitAggregate: boolean;
}

// `counterPath` semantics: omitted → the env-derived per-step sidecar file;
// `null` → instance-local state, guaranteed to touch no file. The null
// sentinel exists because passing `undefined` explicitly triggers the
// default parameter (JS semantics) — in CI that silently pointed unit tests
// at the REAL step counter, found by trial run cderv/quarto-cli#29767179626.
export class AnnotationBudget {
  private localCount = 0;
  // Set once a persisted write throws, so readCount() stops re-reading the
  // stale (or absent) file: without this, every subsequent recordFailure()
  // sees the same value again, repeating the ordinal and never crossing
  // `max` to fire the aggregate.
  private persistenceFailed = false;
  private readonly counterPath: string | null;
  constructor(
    private readonly max = 9,
    counterPath?: string | null,
  ) {
    this.counterPath = counterPath === undefined
      ? defaultAnnotationCounterPath() ?? null
      : counterPath;
  }

  private readCount(): number {
    if (this.counterPath === null || this.persistenceFailed) {
      return this.localCount;
    }
    try {
      return parseInt(Deno.readTextFileSync(this.counterPath), 10) || 0;
    } catch {
      return 0;
    }
  }

  private writeCount(n: number): void {
    // Kept in step regardless of persistence outcome, so the moment a write
    // fails, localCount already holds the last-known-good value to resume
    // counting from.
    this.localCount = n;
    if (this.counterPath === null) {
      return;
    }
    try {
      Deno.writeTextFileSync(this.counterPath, String(n));
    } catch {
      // Best-effort, like readCount: recordFailure() runs while a test
      // failure is already in flight, so a counter-file error must not
      // replace it. A lost write can only repeat an ordinal, so degrade to
      // counting in this instance from here on. That restores monotonicity
      // only WITHIN one instance: Deno gives each test file its own module
      // graph, so the harness builds one budget per FILE and the sidecar is
      // the only thing that ties them into a step-wide count (see the
      // per-file module instance note in the design doc). Once it is
      // unwritable there is no shared channel left FROM THIS INSTANCE
      // ONWARD — but a fresh instance in the next test file starts with
      // persistenceFailed=false and still calls readCount(), which still
      // reads the sidecar. If that file is unwritable but readable and
      // holds a stale nonzero count, the next file resumes from that value,
      // not from 1. Only a missing, unreadable, or zero-valued sidecar
      // makes a file resume from 1. Either way, ordinals may repeat or
      // collide across files and the step can exceed `max`; the runner caps
      // annotations per step regardless, so the excess is dropped by GitHub
      // rather than by us.
      this.persistenceFailed = true;
    }
  }

  // Record one failure and decide what to emit for it. Returns the step-wide
  // ordinal (the running count, used to build the failure's navigation label
  // — every failure gets one, uncapped) alongside the emit decisions. The
  // aggregate fires exactly when the count first crosses the cap — no
  // end-of-run hook exists that spans test files, so it must be emitted inline
  // by the failure that crosses the line; later failures emit nothing.
  recordFailure(): AnnotationDecision {
    const count = this.readCount() + 1;
    this.writeCount(count);
    return {
      ordinal: count,
      emitAnnotation: count <= this.max,
      emitAggregate: count === this.max + 1,
    };
  }
}

// GITHUB_STEP_SUMMARY is 1 MiB per step and content just under the limit can
// be silently dropped (actions/runner#4337). Stay at ~half so bucket mode —
// many processes appending to the same file — has headroom; the file size
// itself is the cross-process coordinator.
export const kStepSummaryBudgetBytes = 512 * 1024;

// Append markdown to the GitHub Actions step summary. No-op when the file is
// unset (local runs, or steps without a summary). `path` semantics: omitted →
// $GITHUB_STEP_SUMMARY; `null` (or "") → guaranteed no-op. Tests must pass
// `null` or a temp path, never an explicit `undefined` — that triggers the
// default parameter and, on CI, writes to the REAL step summary (found by
// trial run cderv/quarto-cli#29767179626). Returns whether the write actually
// happened, so a caller deciding what got recorded doesn't have to guess.
export function stepSummary(
  markdown: string,
  path?: string | null,
): boolean {
  const p = path === undefined ? Deno.env.get("GITHUB_STEP_SUMMARY") : path;
  if (!p) return false;
  try {
    Deno.writeTextFileSync(p, markdown, { append: true });
    return true;
  } catch {
    // Best-effort: callers append while a test failure is already in flight
    // (and from the unload handler, after the run), so a summary write error
    // must not replace the failure being reported. A lost append costs a row,
    // which the returned `false` lets the caller account for.
    return false;
  }
}

// Current size of the step-summary file (0 when unset/missing). Callers
// compare against kStepSummaryBudgetBytes to decide whether to degrade.
// Same `path` semantics as stepSummary.
export function stepSummarySize(
  path?: string | null,
): number {
  const p = path === undefined ? Deno.env.get("GITHUB_STEP_SUMMARY") : path;
  if (!p) return 0;
  try {
    return Deno.statSync(p).size;
  } catch {
    return 0;
  }
}

// Byte cap for a single excerpt embedded in the step summary or an
// annotation. kExcerptLines (tests/test.ts) bounds excerpt LINE COUNT but
// not LINE LENGTH — a single line can run to hundreds of KB when an
// assertion message carries a base64 data URI, a serialized document, or a
// long JSON payload. Kept well under kStepSummaryBudgetBytes so one
// failure's excerpt cannot dominate the shared step-summary budget on its
// own.
export const kExcerptMaxBytes = 8 * 1024;

// UTF-8 byte length of a string, matching how Deno.statSync (and therefore
// stepSummarySize) measures the summary file.
function utf8ByteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

// Decode a UTF-8 byte slice with the default (non-fatal) TextDecoder, which
// turns a multi-byte sequence split by the cut into U+FFFD instead of
// throwing, and drop any trailing replacement character so it doesn't sit
// right before whatever follows.
function decodeUtf8Prefix(encoded: Uint8Array): string {
  return new TextDecoder().decode(encoded).replace(/�+$/, "");
}

// Truncate `s` to at most `maxBytes` UTF-8 bytes. Cuts on the encoded byte
// array, never on a JS string index (which does not correspond to bytes for
// non-ASCII content).
export function truncateUtf8Bytes(s: string, maxBytes: number): string {
  const encoded = new TextEncoder().encode(s);
  if (encoded.length <= maxBytes) return s;
  const marker = "\n…[truncated]";
  const markerBytes = utf8ByteLength(marker);
  if (maxBytes <= markerBytes) {
    // No production caller passes a budget this small — every real call
    // site's maxBytes is a multi-KB constant. The clamp exists so "at most
    // maxBytes bytes" stays true unconditionally, even here: without it the
    // budget below would go negative, clamp to 0, and the full marker would
    // be returned regardless of maxBytes.
    return decodeUtf8Prefix(
      new TextEncoder().encode(marker).subarray(0, Math.max(0, maxBytes)),
    );
  }
  const budget = maxBytes - markerBytes;
  return decodeUtf8Prefix(encoded.subarray(0, budget)) + marker;
}

// Emitted into the step summary at most once, in place of content that no
// longer fits (see appendStepSummaryBounded). Points at the step LOG, which
// carries the complete record: Deno's own ERRORS/FAILURES sections list
// every failure in full and are deliberately kept outside collapsed groups
// (dev-docs/ci-test-log-grouping-design.md invariant 3 and 4).
export const kStepSummaryTruncationNotice =
  "\n**Step summary truncated — remaining failure detail was not recorded here. See this step's log (the ERRORS/FAILURES sections) for the complete record.**\n";

// Content budget: kStepSummaryBudgetBytes minus headroom for one truncation
// notice, so a content write that gets refused still leaves room to append
// that notice.
const kStepSummaryContentBudgetBytes = kStepSummaryBudgetBytes -
  utf8ByteLength(kStepSummaryTruncationNotice);

function fitsInStepSummary(
  markdown: string,
  limitBytes: number,
  path: string,
): boolean {
  return stepSummarySize(path) + utf8ByteLength(markdown) <= limitBytes;
}

// Append markdown to the step summary only if the running total stays
// within budget. Replaces the old sample-then-append pattern, where both
// call sites stat the file BEFORE appending content of unaccounted length —
// a threshold, not a cap, so content near GitHub's 1 MiB step-summary limit
// can be silently discarded (actions/runner#4337). Every step-summary write
// goes through here.
//
// The FIRST write this refuses triggers the truncation notice, appended in
// its place; idempotent by checking the file's own content for the notice
// text, so the notice survives being called from many failing tests across
// many test-file module instances (see the SCOPE WARNING at the top of
// tests/test.ts) without duplicating.
export function appendStepSummaryBounded(
  markdown: string,
  path?: string | null,
): boolean {
  const p = path === undefined ? Deno.env.get("GITHUB_STEP_SUMMARY") : path;
  if (!p) return false;
  if (appendIfFits(markdown, p)) return true;
  emitTruncationNotice(p);
  return false;
}

// Write `markdown` if it fits within the content budget (which already
// reserves headroom for one truncation notice), returning whether it did.
function appendIfFits(markdown: string, path: string): boolean {
  if (!fitsInStepSummary(markdown, kStepSummaryContentBudgetBytes, path)) {
    return false;
  }
  return stepSummary(markdown, path);
}

// Append the truncation notice in place of content that no longer fits.
// Idempotent by checking the file's own content for the notice text, so the
// notice survives being called from many failing tests across many
// test-file module instances (see the SCOPE WARNING at the top of
// tests/test.ts) without duplicating.
function emitTruncationNotice(path: string): void {
  let existing = "";
  try {
    existing = Deno.readTextFileSync(path);
  } catch {
    // Not yet created, or unreadable — treat as "notice not yet emitted"
    // and fall through to the write attempt below.
  }
  if (
    !existing.includes(kStepSummaryTruncationNotice) &&
    fitsInStepSummary(
      kStepSummaryTruncationNotice,
      kStepSummaryBudgetBytes,
      path,
    )
  ) {
    stepSummary(kStepSummaryTruncationNotice, path);
  }
}

// Try each candidate in order and write the first that fits, returning its
// index (or -1 if none fit). Exists because appendStepSummaryBounded alone
// pushed callers toward a bug: trying a full-size write, and on refusal
// immediately emitting the truncation notice, consumes the very headroom
// that a smaller fallback candidate (e.g. a name-only row) needed — so a
// fallback that would have fit BEFORE the notice was written gets refused
// AFTER it. Deferring the notice until every candidate has been tried keeps
// the content budget available to the smaller candidates first, and the
// notice is only emitted once it is known that nothing else will fit either
// (or that the preferred candidate was dropped in favor of a smaller one).
export function appendStepSummaryFirstFit(
  candidates: string[],
  path?: string | null,
): number {
  const p = path === undefined ? Deno.env.get("GITHUB_STEP_SUMMARY") : path;
  if (!p) return -1;
  for (let i = 0; i < candidates.length; i++) {
    if (appendIfFits(candidates[i], p)) {
      // A non-first candidate means the preferred (larger) one was dropped;
      // say so before recording the fallback that was actually written.
      if (i > 0) emitTruncationNotice(p);
      return i;
    }
  }
  emitTruncationNotice(p);
  return -1;
}

function htmlEscape(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

// A table cell must not contain a raw `|` (column separator) or newline (row
// terminator); HTML-escape the rest so angle brackets in test names render,
// then backslash-escape the characters that trigger GFM code-span/emphasis
// parsing so a stray backtick, underscore or asterisk in a test name can't
// open a code span or emphasis run and corrupt the table's rendering. The
// pre-existing backslash escape must run FIRST: escaping `_`/`` ` ``/`*`
// before a name's own literal backslash would let the freshly-added escape
// backslash pair with that pre-existing one into `\\`, leaving the character
// after it unescaped and live again.
function summaryCell(s: string): string {
  return htmlEscape(s)
    .replaceAll("\\", "\\\\")
    .replaceAll("`", "\\`")
    .replaceAll("_", "\\_")
    .replaceAll("*", "\\*")
    .replaceAll("|", "\\|")
    .replace(/\r?\n/g, " ");
}

function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

// Longest job tag kept in a label: the label leads a summary table column, a
// `####` heading and an annotation title, so it has to stay short. Callers
// must therefore be distinct within this budget.
const kMaxLabelTagChars = 8;

// A failure's navigation label: the step-wide ordinal, prefixed with the
// runner OS (RUNNER_OS: "Linux"/"Windows"/"macOS"; anything else → X) and a
// job tag supplied by the workflow. It is the Ctrl+F target that ties a table
// row to its detail block (step-summary heading anchors do not resolve, so
// there is no link; the shared ASCII label is the navigation).
//
// The run summary page concatenates every job's summary and the ordinal
// restarts at 1 in each job, so the OS prefix alone is NOT enough: a bucketed
// run is ~20 ubuntu jobs and would print `L-F1` ~20 times on one page. The
// discriminator has to come from the workflow (`label-tag` →
// QUARTO_TESTS_GHA_LABEL_TAG) because no ambient variable is unique per
// matrix leg — GITHUB_JOB is the YAML job key, shared by every leg, and
// GITHUB_RUN_ID/GITHUB_RUN_ATTEMPT are run-wide. Non-alphanumerics are
// dropped rather than escaped so the label survives the summary cell, the
// HTML-escaped heading and the annotation title unchanged. With no tag the
// label falls back to `<prefix>-F<ordinal>`, which does not distinguish two
// jobs on the same OS.
export function failureLabel(
  ordinal: number,
  runnerOs: string,
  tag = "",
): string {
  const os = runnerOs.toLowerCase();
  const prefix = os.startsWith("linux")
    ? "L"
    : os.startsWith("windows")
    ? "W"
    : os.startsWith("macos")
    ? "M"
    : "X";
  const jobTag = tag.replace(/[^A-Za-z0-9]/g, "").slice(0, kMaxLabelTagChars);
  return `${prefix}${jobTag}-F${ordinal}`;
}

// The clustering key for a failure: the first three non-empty lines of the
// ANSI-stripped excerpt. Three, not one, because the first line alone is a
// generic banner for many failure kinds and would over-cluster.
export function excerptSignature(excerpt: string): string {
  return stripAnsi(excerpt)
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .slice(0, 3)
    .join("\n");
}

export function summaryTableHeader(): string {
  return "| # | Test file | Test | Duration |\n| :-- | :-- | :-- | --: |\n";
}

export function summaryTableRow(
  label: string,
  file: string,
  name: string,
  durationMs: number,
): string {
  return `| ${label} | \`${file}\` | ${summaryCell(name)} | ${
    formatDuration(durationMs)
  } |\n`;
}

// Degraded row emitted once the summary file is over budget: the failure is
// still recorded by name (the complete record), just without duration/output.
// The label column renders the same plain text as a full row.
export function summaryTableRowNameOnly(
  label: string,
  file: string,
  name: string,
): string {
  return `| ${label} | \`${file}\` | ${summaryCell(name)} | |\n`;
}

export interface ClusterMember {
  label: string;
  file: string;
  testName: string;
  repro: string;
}

export interface FailureCluster {
  label: string;
  members: ClusterMember[];
  excerpt: string;
}

// Expandable output block for one CLUSTER of same-signature failures. Preceded
// by a label-only `#### L-F7` heading (the second Ctrl+F hit). The <summary>
// label names the first failing test (file + test name); with >1 member it
// also carries the member count and lists every member (label + file + repro).
// One shared excerpt (the first member's) renders inside a <pre> with
// HTML-escaped content so backticks/pipes/angle brackets in captured output
// can't break out. GFM ends a table at the first non-row line, so these blocks
// are flushed after all table rows, never interleaved between them.
export function summaryClusterBlock(cluster: FailureCluster): string {
  const first = cluster.members[0];
  const n = cluster.members.length;
  const count = n > 1 ? ` (${n} tests)` : "";
  const summaryLabel = `<code>${htmlEscape(first.file)}</code> — ${
    htmlEscape(first.testName).replace(/\r?\n/g, " ")
  }${count}`;
  // With more than one member, list every clustered failure (label + file +
  // repro) so the reader can reach each one; the shared excerpt is shown once.
  let memberList = "";
  if (n > 1) {
    memberList = "\n" + cluster.members
      .map((m) =>
        `- ${m.label} · <code>${htmlEscape(m.file)}</code> (<code>${
          htmlEscape(m.repro)
        }</code>)`
      )
      .join("\n") + "\n";
  }
  const body = htmlEscape(`${first.repro}\n\n${cluster.excerpt}`);
  return `\n#### ${cluster.label}\n\n<details><summary>${summaryLabel}</summary>\n${memberList}\n<pre>\n${body}\n</pre>\n</details>\n\n`;
}

// What the step summary holds for this failure at annotation-emit time. See
// dev-docs/ci-test-log-grouping-design.md invariant 4.
//  - "detail": the full row AND a detail-block cluster were queued, but
//    whether the cluster survives the end-of-file flush (bounded by the same
//    shared budget) is not knowable here — a later file's content could still
//    exhaust the budget first — so the wording stays honest and unconditional
//    rather than promising a detail block a later flush might drop.
//  - "name-only": the full row was over budget and the harness degraded to a
//    name-only row; no cluster was queued. Known synchronously, so the
//    pointer names the row only and makes no promise about detail.
//  - "none": neither row fit — nothing was recorded under this label in the
//    step summary at all. The pointer must not name the label as a summary
//    target or claim any row exists; it can only point at the step log.
export type SummaryRowOutcome = "detail" | "name-only" | "none";

// Trimmed annotation message: the repro, a blank line, the first `maxLines`
// non-empty excerpt lines (byte-capped defensively, in case a caller passes
// an excerpt it did not already bound), an ellipsis, then a pointer whose
// wording depends on `outcome` (see SummaryRowOutcome).
export function annotationBody(
  repro: string,
  excerpt: string,
  label: string,
  outcome: SummaryRowOutcome,
  maxLines = 5,
): string {
  const allLines = stripAnsi(truncateUtf8Bytes(excerpt, kExcerptMaxBytes))
    .split("\n")
    .filter((line) => line.trim().length > 0);
  const truncated = allLines.length > maxLines;
  const lines = allLines.slice(0, maxLines);
  let pointer: string;
  switch (outcome) {
    case "detail":
      pointer =
        `Failure row: step summary → ${label} — details may be truncated; the step log has the complete record`;
      break;
    case "name-only":
      pointer =
        `Failure row (name only): step summary → ${label} — no detail block was recorded; see the step log for the complete record`;
      break;
    case "none":
      pointer =
        `Not recorded in the step summary (over budget) — see the step log for the complete record`;
      break;
  }
  const ellipsis = truncated ? "\n…" : "";
  return `${repro}\n\n${lines.join("\n")}${ellipsis}\n${pointer}`;
}

// GitHub API

// A Github Release for a Github Repo

// Look up the latest release for a Github Repo
export async function getLatestRelease(repo: string): Promise<GitHubRelease> {
  const url = `https://api.github.com/repos/${repo}/releases/latest`;
  const headers = Deno.env.get("GH_TOKEN")
    ? { headers: { Authorization: "Bearer " + Deno.env.get("GH_TOKEN") } }
    : undefined;
  const response = await fetch(url, headers);
  if (response.status !== 200) {
    throw new Error(
      `Unable to determine latest release for ${repo}\n${response.status} - ${response.statusText}`,
    );
  } else {
    return response.json();
  }
}
