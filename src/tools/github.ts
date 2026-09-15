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

// Test reporting helpers. See llm-docs/github-actions-test-reporting.md.

// Annotations and step summaries do not render ANSI escapes.
// deno-lint-ignore no-control-regex
const kAnsiPattern = /\x1b\[[0-9;?]*[A-Za-z]/g;
export function stripAnsi(s: string): string {
  return s.replace(kAnsiPattern, "");
}

// The harness owns workflow commands on CI unless an outer loop claims them.
// Omitting `orchestrated` reads the environment; `null` treats it as unset.
export function harnessOwnsStep(
  githubActions: boolean = isGitHubActions(),
  orchestrated?: string | null,
): boolean {
  const o = orchestrated === undefined
    ? Deno.env.get("QUARTO_TESTS_GHA_ORCHESTRATED")
    : orchestrated;
  return githubActions && !o;
}

// Deno module state is per test file, so persist the step-wide annotation
// count beside the runner-provided summary file.
export function defaultAnnotationCounterPath(): string | undefined {
  const summary = Deno.env.get("GITHUB_STEP_SUMMARY");
  return summary ? `${summary}.qt-annotation-count` : undefined;
}

export interface AnnotationDecision {
  // Step-wide, one-based failure count.
  ordinal: number;
  // Emit an annotation for this failure.
  emitAnnotation: boolean;
  // Emit the single aggregate annotation after the per-test limit.
  emitAggregate: boolean;
}

// Omitting `counterPath` uses the step sidecar; `null` uses local state.
export class AnnotationBudget {
  private localCount = 0;
  // Continue monotonically in this instance after persistence fails.
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
    this.localCount = n;
    if (this.counterPath === null) {
      return;
    }
    try {
      Deno.writeTextFileSync(this.counterPath, String(n));
    } catch {
      // Reporting is best-effort and must not replace the original failure.
      this.persistenceFailed = true;
    }
  }

  // The first failure after the per-test limit emits the aggregate annotation.
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

// Leave margin below GitHub's 1 MiB per-step limit (actions/runner#4337).
export const kStepSummaryBudgetBytes = 512 * 1024;

// Omitting `path` uses GITHUB_STEP_SUMMARY; `null` or "" disables the write.
// Returns false when the path is unavailable or the best-effort write fails.
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
    return false;
  }
}

// Return zero when the summary path is unset, missing, or unreadable.
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

// A line count alone cannot bound serialized data or other very long lines.
export const kExcerptMaxBytes = 8 * 1024;

function utf8ByteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

// Drop replacement characters produced by slicing through a code point.
function decodeUtf8Prefix(encoded: Uint8Array): string {
  return new TextDecoder().decode(encoded).replace(/�+$/, "");
}

// Truncate to at most `maxBytes` of UTF-8, including the marker.
export function truncateUtf8Bytes(s: string, maxBytes: number): string {
  const encoded = new TextEncoder().encode(s);
  if (encoded.length <= maxBytes) return s;
  const marker = "\n…[truncated]";
  const markerBytes = utf8ByteLength(marker);
  if (maxBytes <= markerBytes) {
    return decodeUtf8Prefix(
      new TextEncoder().encode(marker).subarray(0, Math.max(0, maxBytes)),
    );
  }
  const budget = maxBytes - markerBytes;
  return decodeUtf8Prefix(encoded.subarray(0, budget)) + marker;
}

// The step log remains the complete record when summary content is dropped.
export const kStepSummaryTruncationNotice =
  "\n**Step summary truncated. See the step log's ERRORS/FAILURES sections for all failures.**\n";

// Reserve room for one truncation notice.
const kStepSummaryContentBudgetBytes = kStepSummaryBudgetBytes -
  utf8ByteLength(kStepSummaryTruncationNotice);

function fitsInStepSummary(
  markdown: string,
  limitBytes: number,
  path: string,
): boolean {
  return stepSummarySize(path) + utf8ByteLength(markdown) <= limitBytes;
}

// Append only when the content fits. The first refusal adds one notice.
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

function appendIfFits(markdown: string, path: string): boolean {
  if (!fitsInStepSummary(markdown, kStepSummaryContentBudgetBytes, path)) {
    return false;
  }
  return stepSummary(markdown, path);
}

// The file content coordinates this across test-file module instances.
function emitTruncationNotice(path: string): void {
  let existing = "";
  try {
    existing = Deno.readTextFileSync(path);
  } catch {
    // Continue with the write attempt.
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

// Try candidates in order before writing the notice, so the notice cannot
// crowd out a smaller fallback. Return the written index, or -1.
export function appendStepSummaryFirstFit(
  candidates: string[],
  path?: string | null,
): number {
  const p = path === undefined ? Deno.env.get("GITHUB_STEP_SUMMARY") : path;
  if (!p) return -1;
  for (let i = 0; i < candidates.length; i++) {
    if (appendIfFits(candidates[i], p)) {
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

// Escape backslashes first so they cannot neutralize later Markdown escapes.
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

const kMaxLabelTagChars = 8;

// Labels are search targets shared by rows, detail blocks, and annotations.
// The workflow tag distinguishes jobs that share an OS and ordinal.
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

// Use enough lines to avoid grouping failures with only a generic first line.
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

// Preserve the failure identity when a full row no longer fits.
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

// Render one escaped excerpt for failures that share a signature.
export function summaryClusterBlock(cluster: FailureCluster): string {
  const first = cluster.members[0];
  const n = cluster.members.length;
  const count = n > 1 ? ` (${n} tests)` : "";
  const summaryLabel = `<code>${htmlEscape(first.file)}</code> — ${
    htmlEscape(first.testName).replace(/\r?\n/g, " ")
  }${count}`;
  let memberList = "";
  if (n > 1) {
    memberList = "\n" + cluster.members
      .map((m) =>
        `- ${m.label} · <code>${htmlEscape(m.file)}</code> (<code>${
          htmlEscape(m.repro)
        }</code>)`
      )
      .join("\n") +
      "\n";
  }
  const body = htmlEscape(`${first.repro}\n\n${cluster.excerpt}`);
  return `\n#### ${cluster.label}\n\n<details><summary>${summaryLabel}</summary>\n${memberList}\n<pre>\n${body}\n</pre>\n</details>\n\n`;
}

// Whether the summary has a full row, a name-only row, or no row. A queued
// detail block may still be dropped when it is flushed under the shared cap.
export type SummaryRowOutcome = "detail" | "name-only" | "none";

// Exported so callers can reserve lines for teardown or cleanup failures.
export const kAnnotationExcerptLines = 5;

// Build a bounded annotation with an accurate summary or log pointer.
export function annotationBody(
  repro: string,
  excerpt: string,
  label: string,
  outcome: SummaryRowOutcome,
  maxLines = kAnnotationExcerptLines,
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
        `Step summary: ${label}. Details may be truncated; see the step log for the complete failure.`;
      break;
    case "name-only":
      pointer =
        `Step summary: ${label} (name only). See the step log for details.`;
      break;
    case "none":
      pointer =
        `Not included in the step summary because it exceeded the size limit. See the step log for details.`;
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
