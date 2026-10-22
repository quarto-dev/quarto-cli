/*
 * check-runtime-boundary.ts
 *
 * Runtime boundary ratchet for the Deno -> Node migration
 * (dev-docs/runtime-migration/02-runtime-boundary-check.md).
 *
 * Counts, per scope, the `Deno.` occurrences and the files that import the
 * standard library directly instead of through src/deno_ral/. Two modes:
 * without flags it fails when any count exceeds the committed baseline (main);
 * with --against <rev> it compares the working tree with <rev> and fails only
 * for a Deno.* API that src/deno_ral already replaces (pull requests).
 *
 * Usage (from the repository root):
 *   quarto run --dev tools/check-runtime-boundary.ts
 *   quarto run --dev tools/check-runtime-boundary.ts --update-baseline
 *   quarto run --dev tools/check-runtime-boundary.ts --update-baseline --accept-increase
 *   quarto run --dev tools/check-runtime-boundary.ts --against <rev>
 *   quarto run --dev tools/check-runtime-boundary.ts --root /path/to/quarto-cli
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { existsSync, walkSync } from "../src/deno_ral/fs.ts";
import { join, relative } from "../src/deno_ral/path.ts";
import { execProcess } from "../src/core/process.ts";
import { error, notice, stepSummary, warning } from "../src/tools/github.ts";

export interface BoundaryCounts {
  denoCalls: number;
  stdImportFiles: number;
}

export type Baseline = Record<string, BoundaryCounts>;

export interface ScopeSpec {
  dir: string;
  exts: string[];
  exclude: string[];
  include?: (rel: string) => boolean;
}

export const kBaselineRelPath = "tools/runtime-boundary-baseline.json";

/** Import-map names that resolve to the std library. deno.land/x packages are not std. */
export const kStdModules: readonly string[] = [
  "async",
  "bytes",
  "crypto",
  "datetime",
  "dotenv",
  "encoding",
  "flags",
  "fmt",
  "fs",
  "http",
  "io",
  "log",
  "path",
  "@std/path",
  "@std/assert",
  "streams",
  "tar",
  "testing",
  "uuid",
];

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const kStdImportRe = new RegExp(
  `(?:\\bfrom|\\bimport)\\s*\\(?\\s*["']((?:` +
    `(?:${kStdModules.map(escapeRe).join("|")})(?:/[^"']*)?` +
    `|https://deno\\.land/std(?:@[^/"']*)?/[^"']*` +
    `|jsr:/?@std/[^"']*` +
    `))["']`,
);

/** The std boundary rule (dev-docs/runtime-migration/02-runtime-boundary-check.md, Context):
 * import-map seams with no runtime Deno.* inside (PR 22's inventory table) are not counted.
 * Exact names, or prefixes ending in "/". */
export const kStdAllowListed: readonly string[] = [
  "async", "async/",
  "crypto", "crypto/",
  "datetime", "datetime/",
  "streams", "streams/",
  "io/",
  "log", "log/",
  "fmt/printf",
  "dotenv/stringify",
];

/** Counted although a prefix above matches: @std/log's FileHandler calls Deno.openSync (PR 20b replaces it). */
export const kStdCountedExceptions: readonly string[] = ["log/file-handler"];

export function isAllowListedStdImport(specifier: string): boolean {
  if (kStdCountedExceptions.includes(specifier)) {
    return false;
  }
  return kStdAllowListed.some((entry) =>
    entry.endsWith("/") ? specifier.startsWith(entry) : specifier === entry
  );
}

const kCommentLineRe = /^\s*(\/\/|\/\*|\*)/;

const kStdImportAllRe = new RegExp(kStdImportRe.source, "g");

/** Per-file counts. `deno` maps the API key to its occurrences: "build.os" for `Deno.build.os`,
 * "readTextFileSync" for `Deno.readTextFileSync(`, "" for a `Deno.` followed by no identifier,
 * so the sum equals the old \bDeno\. count. `std` lists counted std specifiers (allow-listed excluded), in source order, duplicates kept. */
export interface FileCounts {
  deno: Record<string, number>;
  std: string[];
}

// The key is read inside a lookahead so a following `Deno.` is never consumed.
const kDenoRe = /\bDeno\.(?=(\w*)(?:\.(\w+))?)/g;

/** Scans every import in the text, so an allow-listed import does not hide a counted one on the
 * same line, and a `from` separated from its specifier by a newline is still seen. Comment lines
 * are blanked, keeping the newlines. */
export function countText(text: string): FileCounts {
  // No prototype: `Deno.constructor` or `Deno.__proto__` in a comment must be an ordinary key.
  const deno: Record<string, number> = Object.create(null);
  for (const match of text.matchAll(kDenoRe)) {
    const key = match[1] + (match[2] ? "." + match[2] : "");
    deno[key] = (deno[key] ?? 0) + 1;
  }
  const code = text
    .split("\n")
    .map((line) => kCommentLineRe.test(line) ? "" : line)
    .join("\n");
  const std = [...code.matchAll(kStdImportAllRe)]
    .map((match) => match[1])
    .filter((specifier) => !isAllowListedStdImport(specifier));
  return { deno, std };
}

export function hasStdImport(text: string): boolean {
  return countText(text).std.length > 0;
}

/** The std module of a specifier, "@std/" stripped so equivalent spellings agree:
 * "fs/ensure-dir", "@std/fs", "jsr:@std/fs@1.0.16/walk" -> "fs"; "testing/asserts" -> "testing";
 * "jsr:/@std/assert" and "https://deno.land/std@0.93.0/assert/assert_object_match.ts" -> "assert";
 * "@std/path", "path" -> "path". */
export function stdModuleOf(specifier: string): string {
  const url = specifier.match(/^https:\/\/deno\.land\/std(?:@[^/]*)?\/([^/]+)/);
  if (url) {
    return url[1];
  }
  const rest = specifier.replace(/^jsr:\/?/, "").replace(/^@std\//, "");
  return rest.split("/")[0].replace(/@.*$/, "");
}

/** Never counted in the `src` scope. A directory entry covers every file beneath it. */
export const kSrcExclusions: readonly string[] = [
  "src/deno_ral", // the runtime layer itself
  "src/vendor", // vendored dependencies
  "src/resources/extension-subtrees", // git subtree of PumasAI/quarto-julia-engine, maintained upstream
  "src/resources/scripts", // `quarto run` fixtures under the user-script runtime (PR 35); counted in `resources`
  "src/resources/create", // .ejs.ts extension templates for users (engine template: PR 36); counted in `resources`
  "src/webui/quarto-preview/build.ts", // that package's own build script (allow-listed until PR 33 deletes it)
];

/** Never counted in the `tests` scope. */
export const kTestsExclusions: readonly string[] = [
  "tests/docs", // documents and user-script fixtures run by Quarto (PR 35 keeps their Deno.* on purpose)
  "tests/asserts.ts", // the assertion seam: the one test file that imports @std/assert
];

const kUserScriptResourceDirs = ["src/resources/scripts/", "src/resources/create/"];

export const kScopes: Readonly<Record<string, ScopeSpec>> = {
  "src": { dir: "src", exts: [".ts"], exclude: [...kSrcExclusions] },
  "src-js": {
    dir: "src",
    exts: [".js", ".mjs"],
    exclude: ["src/vendor", "src/resources"],
  },
  "resources": {
    dir: "src/resources",
    exts: [".js", ".mjs", ".ts"],
    exclude: [
      "src/resources/extension-subtrees",
      "src/resources/deno_std/cache",
    ],
    include: (rel) =>
      !rel.endsWith(".ts") ||
      kUserScriptResourceDirs.some((d) => rel.startsWith(d)),
  },
  "package/src": { dir: "package/src", exts: [".ts"], exclude: [] },
  "tests": { dir: "tests", exts: [".ts"], exclude: [...kTestsExclusions] },
};

const kSkip = [/node_modules/, /\.venv/];

function isExcluded(rel: string, exclude: string[]): boolean {
  return exclude.some((e) => rel === e || rel.startsWith(e + "/"));
}

function inScope(rel: string, spec: ScopeSpec): boolean {
  return rel.startsWith(spec.dir + "/") &&
    spec.exts.some((ext) => rel.endsWith(ext)) &&
    !kSkip.some((re) => re.test(rel)) &&
    !isExcluded(rel, spec.exclude) &&
    (!spec.include || spec.include(rel));
}

/** The scopes a repository-relative path (forward slashes) is counted in: same exts, exclude, include and kSkip rules as countScope. */
export function scopesOf(rel: string): string[] {
  return Object.entries(kScopes)
    .filter(([_name, spec]) => inScope(rel, spec))
    .map(([name]) => name);
}

export function countScope(root: string, spec: ScopeSpec): BoundaryCounts {
  let denoCalls = 0;
  let stdImportFiles = 0;
  const dir = join(root, ...spec.dir.split("/"));
  if (!existsSync(dir)) {
    return { denoCalls, stdImportFiles };
  }
  for (
    const entry of walkSync(dir, {
      exts: spec.exts,
      includeDirs: false,
      skip: kSkip,
    })
  ) {
    const rel = relative(root, entry.path).replaceAll("\\", "/");
    if (!inScope(rel, spec)) {
      continue;
    }
    const counts = countText(Deno.readTextFileSync(entry.path));
    denoCalls += Object.values(counts.deno).reduce((a, b) => a + b, 0);
    if (counts.std.length > 0) {
      stdImportFiles++;
    }
  }
  return { denoCalls, stdImportFiles };
}

export function measure(root: string): Baseline {
  const result: Baseline = {};
  for (const [name, spec] of Object.entries(kScopes)) {
    result[name] = countScope(root, spec);
  }
  return result;
}

const kFieldLabels: Record<keyof BoundaryCounts, string> = {
  denoCalls: "Deno.* calls",
  stdImportFiles: "std-import files",
};
const kFields = ["denoCalls", "stdImportFiles"] as const;

export function compareToBaseline(
  current: Baseline,
  baseline: Baseline,
): { regressions: string[]; improvements: string[] } {
  const regressions: string[] = [];
  const improvements: string[] = [];
  for (const [scope, counts] of Object.entries(current)) {
    const base = baseline[scope] ?? { denoCalls: 0, stdImportFiles: 0 };
    for (const field of kFields) {
      if (counts[field] > base[field]) {
        regressions.push(
          `${scope}: ${kFieldLabels[field]} rose from ${base[field]} to ${counts[field]}`,
        );
      } else if (counts[field] < base[field]) {
        improvements.push(
          `${scope}: ${kFieldLabels[field]} fell from ${base[field]} to ${counts[field]}`,
        );
      }
    }
  }
  return { regressions, improvements };
}

export function lowerBaseline(current: Baseline, baseline: Baseline): Baseline {
  const result: Baseline = {};
  for (const [scope, counts] of Object.entries(current)) {
    const base = baseline[scope] ?? counts;
    result[scope] = {
      denoCalls: Math.min(counts.denoCalls, base.denoCalls),
      stdImportFiles: Math.min(counts.stdImportFiles, base.stdImportFiles),
    };
  }
  return result;
}

/** The current counts for every scope, raised or lowered. */
export function acceptIncrease(current: Baseline): Baseline {
  return Object.fromEntries(
    Object.entries(current).map(([scope, counts]) => [scope, { ...counts }]),
  );
}

/** Keyed by exact API key. A PR that adds a deno_ral replacement adds its keys here. */
export const kRalDenoReplacements: Readonly<
  Record<string, { hint: string; scopes?: readonly string[] }>
> = {
  "build.os": {
    hint: "os (or isWindows, isMac, isLinux) from src/deno_ral/platform.ts",
  },
  "build.arch": { hint: "arch from src/deno_ral/platform.ts" },
};

/** Keyed by stdModuleOf(). `module` is repository-relative. A suggestion only: never turns a finding into an error. */
export const kStdSuggestions: Readonly<
  Record<string, { module: string; scopes?: readonly string[] }>
> = {
  "path": { module: "src/deno_ral/path.ts" },
  "fs": { module: "src/deno_ral/fs.ts" },
  "testing": { module: "tests/asserts.ts", scopes: ["tests"] },
  "assert": { module: "tests/asserts.ts", scopes: ["tests"] },
};

export function denoReplacement(api: string, scope: string): string | undefined {
  const entry = Object.hasOwn(kRalDenoReplacements, api)
    ? kRalDenoReplacements[api]
    : undefined;
  return entry && (!entry.scopes || entry.scopes.includes(scope))
    ? entry.hint
    : undefined;
}

export function stdSuggestion(specifier: string, scope: string): string | undefined {
  const module = stdModuleOf(specifier);
  const entry = Object.hasOwn(kStdSuggestions, module)
    ? kStdSuggestions[module]
    : undefined;
  return entry && (!entry.scopes || entry.scopes.includes(scope))
    ? entry.module
    : undefined;
}

export interface FileChange {
  path: string; // repository-relative, forward slashes, verbatim (no git quoting)
  before: string | null; // text at the base revision, null only when the path is absent there
  after: string | null; // text in the working tree, null if deleted
  addedLines: number[]; // 1-based line numbers in `after` that the diff adds
}

export interface Finding {
  scope: string;
  file: string;
  kind: "deno" | "std";
  name: string; // API key, or the std specifier as written
  delta: number; // > 0 (deno: this file's increase of the API; std: 1)
  line?: number; // first added line containing the occurrence
  replacement?: string; // deno only; set = covered = error
  suggestion?: string; // std only: module from kStdSuggestions
}

export interface DeltaReport {
  deltas: Record<string, BoundaryCounts>; // per scope, after minus before, over the changed files; may be negative
  findings: Finding[];
}

const sum = (counts: Record<string, number>) =>
  Object.values(counts).reduce((a, b) => a + b, 0);

function firstAddedLine(
  change: FileChange,
  needle: string,
): number | undefined {
  const lines = (change.after ?? "").split("\n");
  return change.addedLines.find((n) => lines[n - 1]?.includes(needle));
}

export function diffChanges(changes: FileChange[]): DeltaReport {
  const deltas: Record<string, BoundaryCounts> = {};
  for (const scope of Object.keys(kScopes)) {
    deltas[scope] = { denoCalls: 0, stdImportFiles: 0 };
  }
  const empty: FileCounts = { deno: Object.create(null), std: [] };
  const entries = changes.map((change) => ({
    change,
    scopes: scopesOf(change.path),
    before: change.before === null ? empty : countText(change.before),
    after: change.after === null ? empty : countText(change.after),
  }));
  for (const { scopes, before, after } of entries) {
    for (const scope of scopes) {
      deltas[scope].denoCalls += sum(after.deno) - sum(before.deno);
      deltas[scope].stdImportFiles += (after.std.length > 0 ? 1 : 0) -
        (before.std.length > 0 ? 1 : 0);
    }
  }

  const findings: Finding[] = [];
  for (const scope of Object.keys(kScopes)) {
    const inScope = entries.filter((e) => e.scopes.includes(scope));

    if (deltas[scope].denoCalls > 0) {
      const apis = new Set(
        inScope.flatMap((e) => [
          ...Object.keys(e.before.deno),
          ...Object.keys(e.after.deno),
        ]),
      );
      for (const api of apis) {
        const own = (e: typeof inScope[number]) =>
          (e.after.deno[api] ?? 0) - (e.before.deno[api] ?? 0);
        if (inScope.reduce((n, e) => n + own(e), 0) <= 0) {
          continue;
        }
        for (const e of inScope) {
          if (own(e) <= 0) {
            continue;
          }
          const finding: Finding = {
            scope,
            file: e.change.path,
            kind: "deno",
            name: api,
            delta: own(e),
          };
          const line = firstAddedLine(e.change, "Deno." + api);
          if (line !== undefined) finding.line = line;
          const replacement = denoReplacement(api, scope);
          if (replacement !== undefined) finding.replacement = replacement;
          findings.push(finding);
        }
      }
    }

    if (deltas[scope].stdImportFiles > 0) {
      const modulesOf = (counts: FileCounts) =>
        new Set(counts.std.map(stdModuleOf));
      const modules = new Set(
        inScope.flatMap((e) => [...modulesOf(e.after)]),
      );
      const stdFinding = (e: typeof inScope[number], name: string): Finding => {
        const finding: Finding = {
          scope,
          file: e.change.path,
          kind: "std",
          name,
          delta: 1,
        };
        const line = firstAddedLine(e.change, name);
        if (line !== undefined) finding.line = line;
        const suggestion = stdSuggestion(name, scope);
        if (suggestion !== undefined) finding.suggestion = suggestion;
        return finding;
      };
      const reported: Finding[] = [];
      for (const module of modules) {
        const importing = (counts: FileCounts) => modulesOf(counts).has(module);
        const net = inScope.filter((e) => importing(e.after)).length -
          inScope.filter((e) => importing(e.before)).length;
        if (net <= 0) {
          continue;
        }
        for (const e of inScope) {
          if (importing(e.after) && !importing(e.before)) {
            reported.push(
              stdFinding(e, e.after.std.find((s) => stdModuleOf(s) === module)!),
            );
          }
        }
      }
      if (reported.length === 0) {
        for (const e of inScope) {
          if (e.after.std.length > 0 && e.before.std.length === 0) {
            reported.push(stdFinding(e, e.after.std[0]));
          }
        }
      }
      findings.push(...reported);
    }
  }
  return { deltas, findings };
}

export interface Annotation {
  message: string;
  file: string;
  line?: number;
}

export interface Rendered {
  errors: Annotation[];
  warnings: Annotation[];
  notices: string[];
  summary: string; // markdown for GITHUB_STEP_SUMMARY
  failed: boolean; // errors.length > 0
}

const kReadmeRelPath = "dev-docs/runtime-migration/README.md";

const kAcceptClause =
  "a maintainer accepts the new count before merging (see the job summary).";
const kAcceptSentence = kAcceptClause[0].toUpperCase() + kAcceptClause.slice(1);

const signed = (n: number) => n > 0 ? `+${n}` : `${n}`;

/** `current` is measure() of the working tree (the merge result on CI), so `current - deltas` is the base. */
export function renderDelta(
  report: DeltaReport,
  current: Baseline,
  baseline: Baseline,
): Rendered {
  const errors: Annotation[] = [];
  const warnings: Annotation[] = [];
  const notices: string[] = [];
  const changes: string[] = [];
  const warnedScopes = new Set<string>();

  for (const finding of report.findings) {
    const annotation = (message: string): Annotation => {
      const result: Annotation = { message, file: finding.file };
      if (finding.line !== undefined) result.line = finding.line;
      return result;
    };
    if (finding.kind === "deno" && finding.replacement !== undefined) {
      errors.push(annotation(
        `${finding.scope}: +${finding.delta} Deno.${finding.name} in ${finding.file}; use ${finding.replacement} instead (runtime boundary, see ${kReadmeRelPath})`,
      ));
      const where = finding.line !== undefined ? ` line ${finding.line}` : "";
      changes.push(
        `- \`${finding.file}\`${where}: use ${finding.replacement} instead of Deno.${finding.name}`,
      );
      continue;
    }
    warnedScopes.add(finding.scope);
    if (finding.kind === "deno") {
      warnings.push(annotation(
        `${finding.scope}: +${finding.delta} Deno.${finding.name} in ${finding.file}; src/deno_ral has no replacement yet, so nothing to change in this PR. ${kAcceptSentence}`,
      ));
    } else if (finding.suggestion !== undefined) {
      warnings.push(annotation(
        `${finding.scope}: ${finding.file} now imports the standard library directly (${finding.name}); if ${finding.suggestion} exports what this file uses with the same behaviour, import it from there. Otherwise nothing to change in this PR: ${kAcceptClause}`,
      ));
    } else {
      warnings.push(annotation(
        `${finding.scope}: ${finding.file} now imports the standard library directly (${finding.name}); there is no runtime-layer replacement for it yet, so nothing to change in this PR. ${kAcceptSentence}`,
      ));
    }
  }

  for (const [scope, counts] of Object.entries(current)) {
    const base = baseline[scope] ?? { denoCalls: 0, stdImportFiles: 0 };
    for (const field of kFields) {
      const before = counts[field] - (report.deltas[scope]?.[field] ?? 0);
      if (before > base[field]) {
        notices.push(
          `main is above ${kBaselineRelPath} (${scope} ${kFieldLabels[field]} ${before} > ${
            base[field]
          }); not caused by this PR, a maintainer fixes main`,
        );
      }
    }
  }

  const rows = Object.entries(report.deltas)
    .filter(([_scope, d]) => d.denoCalls !== 0 || d.stdImportFiles !== 0)
    .map(([scope, d]) =>
      `| ${scope} | ${signed(d.denoCalls)} | ${signed(d.stdImportFiles)} |`
    );
  const summary = ["## Runtime boundary", ""];
  if (rows.length === 0) {
    summary.push("No count changed in this PR.", "");
  } else {
    summary.push(
      "| scope | Deno.* calls | std-import files |",
      "|---|---|---|",
      ...rows,
      "",
    );
  }
  if (errors.length > 0) {
    summary.push("### What to change", "", ...changes, "");
  }
  if (warnings.length > 0) {
    const expected = Object.entries(current)
      .filter(([scope]) => warnedScopes.has(scope))
      .map(([scope, c]) => `${scope} ${c.denoCalls} / ${c.stdImportFiles}`)
      .join(", ");
    summary.push(
      "### Maintainer action before merging",
      "",
      "This PR raises counts (warnings above). Where a warning suggests a module, check whether the PR should use it; accept the rest. Before merging, update the branch with `main`, then run",
      "",
      "    quarto run --dev tools/check-runtime-boundary.ts --update-baseline --accept-increase",
      "",
      `and push the \`${kBaselineRelPath}\` change to this PR. Expected counts after merge: ${expected}.`,
      "",
    );
  }
  return {
    errors,
    warnings,
    notices,
    summary: summary.join("\n"),
    failed: errors.length > 0,
  };
}

/** Parses `git diff -U0` output for one file into the added line numbers of the new side. */
export function parseAddedLines(diff: string): number[] {
  const lines: number[] = [];
  for (const hunk of diff.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)) {
    const start = Number(hunk[1]);
    const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
    for (let n = start; n < start + count; n++) {
      lines.push(n);
    }
  }
  return lines;
}

async function runGit(root: string, args: string[]): Promise<string> {
  const result = await execProcess({
    cmd: "git",
    args,
    cwd: root,
    stdout: "piped",
    stderr: "piped",
  });
  if (!result.success) {
    throw new Error(
      `check-runtime-boundary: git ${args.join(" ")} failed: ${
        (result.stderr ?? "").trim()
      }`,
    );
  }
  return result.stdout ?? "";
}

const nulSeparated = (output: string) => output.split("\0").filter(Boolean);

/** Changed and untracked files under any scope, working tree vs `rev`, renames split into delete + add.
 * Throws Error("check-runtime-boundary: <rev> is not a commit") for an unknown revision and
 * Error("check-runtime-boundary: git <args> failed: <stderr>") for any other failing git call. */
export async function gitChanges(
  root: string,
  rev: string,
): Promise<FileChange[]> {
  try {
    await runGit(root, ["rev-parse", "--verify", "--quiet", `${rev}^{commit}`]);
  } catch {
    throw new Error(`check-runtime-boundary: ${rev} is not a commit`);
  }
  const tracked = nulSeparated(
    await runGit(root, ["diff", "-z", "--name-only", "--no-renames", rev, "--"]),
  );
  const untracked = nulSeparated(
    await runGit(root, ["ls-files", "-z", "--others", "--exclude-standard"]),
  );
  const paths = [...new Set([...tracked, ...untracked])].filter((path) =>
    scopesOf(path).length > 0
  );
  if (paths.length === 0) {
    return [];
  }
  const atRev = new Set(
    nulSeparated(
      await runGit(root, ["ls-tree", "-z", "-r", "--name-only", rev, "--", ...paths]),
    ),
  );
  const changes: FileChange[] = [];
  for (const path of paths) {
    const before = atRev.has(path)
      ? await runGit(root, ["show", `${rev}:${path}`])
      : null;
    const file = join(root, ...path.split("/"));
    const after = existsSync(file) ? Deno.readTextFileSync(file) : null;
    let addedLines: number[] = [];
    if (after !== null) {
      if (before === null) {
        const count = after.split("\n").length - (after.endsWith("\n") ? 1 : 0);
        addedLines = Array.from({ length: after.length === 0 ? 0 : count }, (_, i) => i + 1);
      } else {
        addedLines = parseAddedLines(
          await runGit(root, ["diff", "-U0", "--no-renames", rev, "--", path]),
        );
      }
    }
    changes.push({ path, before, after, addedLines });
  }
  return changes;
}

const isCount = (n: unknown) => Number.isInteger(n) && (n as number) >= 0;

/** Parses a baseline file, rejecting any scope without a non-negative integer for each field:
 * a missing field would make its comparison always false and silently disable that constraint. */
export function parseBaseline(text: string): Baseline {
  const parsed: unknown = JSON.parse(text);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("baseline must be a JSON object keyed by scope");
  }
  for (const [scope, counts] of Object.entries(parsed)) {
    for (const field of kFields) {
      if (!isCount((counts as Record<string, unknown> | null)?.[field])) {
        throw new Error(
          `baseline scope "${scope}": ${field} must be a non-negative integer`,
        );
      }
    }
  }
  return parsed as Baseline;
}

function readBaseline(path: string): Baseline {
  if (!existsSync(path)) {
    return {};
  }
  try {
    return parseBaseline(Deno.readTextFileSync(path));
  } catch (e) {
    console.error(
      `check-runtime-boundary: cannot use ${kBaselineRelPath}: ${(e as Error).message}`,
    );
    Deno.exit(2);
  }
}

function printTable(current: Baseline, baseline: Baseline) {
  const pad = (s: string, n: number) => s.padEnd(n);
  console.log(pad("scope", 14) + pad("Deno.* calls", 24) + "std-import files");
  for (const [scope, counts] of Object.entries(current)) {
    const base = baseline[scope];
    const cell = (field: keyof BoundaryCounts) =>
      `${counts[field]} (baseline ${base ? base[field] : "none"})`;
    console.log(
      pad(scope, 14) + pad(cell("denoCalls"), 24) + cell("stdImportFiles"),
    );
  }
}

if (import.meta.main) {
  const args = [...Deno.args];
  const rootIndex = args.indexOf("--root");
  const root = rootIndex >= 0 ? args[rootIndex + 1] : Deno.cwd();
  const update = args.includes("--update-baseline");
  const accept = args.includes("--accept-increase");
  const againstIndex = args.indexOf("--against");
  const against = againstIndex >= 0 ? args[againstIndex + 1] : undefined;

  const usage = (message: string) => {
    console.error(`check-runtime-boundary: ${message}`);
    Deno.exit(2);
  };
  if (accept && !update) {
    usage("--accept-increase is only valid with --update-baseline");
  }
  if (againstIndex >= 0 && against === undefined) {
    usage("--against needs a revision");
  }
  if (againstIndex >= 0 && update) {
    usage("--against cannot be combined with --update-baseline");
  }
  if (!existsSync(join(root, "src", "quarto.ts"))) {
    console.error(
      `check-runtime-boundary: ${root} is not the quarto-cli root (src/quarto.ts not found); run from the repository root or pass --root`,
    );
    Deno.exit(2);
  }

  const baselinePath = join(root, ...kBaselineRelPath.split("/"));
  const baseline = readBaseline(baselinePath);
  const current = measure(root);

  console.log(`Runtime boundary check (baseline: ${kBaselineRelPath})`);
  printTable(current, baseline);

  if (update) {
    const next = accept
      ? acceptIncrease(current)
      : lowerBaseline(current, baseline);
    if (accept) {
      for (const [scope, counts] of Object.entries(next)) {
        for (const field of kFields) {
          const before = baseline[scope]?.[field];
          if (before !== undefined && counts[field] > before) {
            console.log(
              `::warning::${scope} baseline raised from ${before} to ${
                counts[field]
              } (${kFieldLabels[field]}); list the new occurrences in the PR description`,
            );
          }
        }
      }
    }
    Deno.writeTextFileSync(baselinePath, JSON.stringify(next, null, 2) + "\n");
    console.log(`Baseline written to ${kBaselineRelPath}`);
    Deno.exit(0);
  }

  if (against !== undefined) {
    let changes: FileChange[];
    try {
      changes = await gitChanges(root, against);
    } catch (e) {
      console.error((e as Error).message);
      Deno.exit(2);
    }
    const rendered = renderDelta(diffChanges(changes), current, baseline);
    for (const message of rendered.notices) {
      notice(message);
    }
    for (const { message, file, line } of rendered.warnings) {
      warning(message, { file, line });
    }
    for (const { message, file, line } of rendered.errors) {
      error(message, { file, line });
    }
    if (!stepSummary(rendered.summary)) {
      console.log(rendered.summary);
    }
    Deno.exit(rendered.failed ? 1 : 0);
  }

  const { regressions, improvements } = compareToBaseline(current, baseline);
  for (const line of improvements) {
    notice(
      `${line}; run 'quarto run --dev tools/check-runtime-boundary.ts --update-baseline' and commit ${kBaselineRelPath}`,
    );
  }
  if (regressions.length > 0) {
    for (const line of regressions) {
      error(
        `${line} on main. A merged PR raised it without updating the baseline: if the new calls have no replacement, run 'quarto run --dev tools/check-runtime-boundary.ts --update-baseline --accept-increase' on main and commit ${kBaselineRelPath}; otherwise replace them (see ${kReadmeRelPath})`,
      );
    }
    Deno.exit(1);
  }
  console.log("OK: no count exceeds the baseline.");
}
