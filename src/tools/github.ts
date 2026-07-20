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
export function harnessOwnsStep(
  githubActions: boolean = isGitHubActions(),
  orchestrated: string | undefined = Deno.env.get(
    "QUARTO_TESTS_GHA_ORCHESTRATED",
  ),
): boolean {
  return githubActions && !orchestrated;
}

// GitHub caps annotations at 10 ::error per workflow STEP; excess is silently
// dropped. In the harness-owned (non-orchestrated) path one `deno test`
// process IS the step, so this module-level budget is exactly a per-step
// budget: allow `max` per-test annotations, leaving room for one aggregate.
export class AnnotationBudget {
  private emitted = 0;
  private suppressed = 0;
  constructor(private readonly max = 9) {}

  // true  → caller should emit a per-test ::error;
  // false → over budget, counts toward the aggregate instead.
  recordFailure(): boolean {
    if (this.emitted < this.max) {
      this.emitted++;
      return true;
    }
    this.suppressed++;
    return false;
  }

  suppressedCount(): number {
    return this.suppressed;
  }
}

// GITHUB_STEP_SUMMARY is 1 MiB per step and content just under the limit can
// be silently dropped (actions/runner#4337). Stay at ~half so bucket mode —
// many processes appending to the same file — has headroom; the file size
// itself is the cross-process coordinator.
export const kStepSummaryBudgetBytes = 512 * 1024;

// Append markdown to the GitHub Actions step summary. No-op when the file is
// unset (local runs, or steps without a summary). `path` is injectable for
// unit tests.
export function stepSummary(
  markdown: string,
  path: string | undefined = Deno.env.get("GITHUB_STEP_SUMMARY"),
): void {
  if (!path) return;
  Deno.writeTextFileSync(path, markdown, { append: true });
}

// Current size of the step-summary file (0 when unset/missing). Callers
// compare against kStepSummaryBudgetBytes to decide whether to degrade.
export function stepSummarySize(
  path: string | undefined = Deno.env.get("GITHUB_STEP_SUMMARY"),
): number {
  if (!path) return 0;
  try {
    return Deno.statSync(path).size;
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

export function summaryTableHeader(): string {
  return "| Test file | Test | Duration |\n| :-- | :-- | --: |\n";
}

export function summaryTableRow(
  file: string,
  name: string,
  durationMs: number,
): string {
  return `| \`${file}\` | ${summaryCell(name)} | ${formatDuration(durationMs)} |\n`;
}

// Degraded row emitted once the summary file is over budget: the failure is
// still recorded by name (the complete record), just without duration/output.
export function summaryTableRowNameOnly(file: string, name: string): string {
  return `| \`${file}\` | ${summaryCell(name)} | |\n`;
}

// Expandable output block for one failure. Uses <pre> (not a ``` fence) with
// HTML-escaped content so backticks/pipes in captured output can't break out.
// GFM ends a table at the first non-row line, so these blocks are flushed
// after all table rows, never interleaved between them.
export function summaryDetailBlock(repro: string, excerpt: string): string {
  const body = htmlEscape(`${repro}\n\n${excerpt}`);
  return `\n<details><summary>output</summary>\n\n<pre>\n${body}\n</pre>\n</details>\n\n`;
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
