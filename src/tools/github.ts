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
    if (this.counterPath === null) return this.localCount;
    try {
      return parseInt(Deno.readTextFileSync(this.counterPath), 10) || 0;
    } catch {
      return 0;
    }
  }

  private writeCount(n: number): void {
    if (this.counterPath === null) {
      this.localCount = n;
      return;
    }
    Deno.writeTextFileSync(this.counterPath, String(n));
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
// trial run cderv/quarto-cli#29767179626).
export function stepSummary(
  markdown: string,
  path?: string | null,
): void {
  const p = path === undefined ? Deno.env.get("GITHUB_STEP_SUMMARY") : path;
  if (!p) return;
  Deno.writeTextFileSync(p, markdown, { append: true });
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

function htmlEscape(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

// A table cell must not contain a raw `|` (column separator) or newline (row
// terminator); HTML-escape the rest so angle brackets in test names render.
function summaryCell(s: string): string {
  return htmlEscape(s).replaceAll("|", "\\|").replace(/\r?\n/g, " ");
}

function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

// A failure's navigation label: the step-wide ordinal prefixed with the
// runner OS (RUNNER_OS: "Linux"/"Windows"/"macOS"; anything else → X). The
// run summary page concatenates every job's summary, so the prefix keeps the
// label unambiguous across jobs — it is the Ctrl+F target that ties a table
// row to its detail block (step-summary heading anchors do not resolve, so
// there is no link; the shared ASCII label is the navigation).
export function failureLabel(ordinal: number, runnerOs: string): string {
  const os = runnerOs.toLowerCase();
  const prefix = os.startsWith("linux")
    ? "L"
    : os.startsWith("windows")
    ? "W"
    : os.startsWith("macos")
    ? "M"
    : "X";
  return `${prefix}-F${ordinal}`;
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

// Trimmed annotation message: the repro, a blank line, the first `maxLines`
// non-empty excerpt lines, an ellipsis, then a pointer at the step-summary
// entry (by label). The full repro+excerpt already lives in the summary on the
// same page, so the annotation only needs enough to identify the failure.
export function annotationBody(
  repro: string,
  excerpt: string,
  label: string,
  maxLines = 5,
): string {
  const lines = stripAnsi(excerpt)
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .slice(0, maxLines);
  return `${repro}\n\n${lines.join("\n")}\n…\nFull output: step summary → ${label}`;
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
