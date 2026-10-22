/*
 * check-runtime-boundary.ts
 *
 * Runtime boundary ratchet for the Deno -> Node migration
 * (dev-docs/runtime-migration/02-runtime-boundary-check.md).
 *
 * Counts, per scope, the `Deno.` occurrences and the files that import the
 * standard library directly instead of through src/deno_ral/, and fails when
 * any count exceeds the committed baseline.
 *
 * Usage (from the repository root):
 *   quarto run --dev tools/check-runtime-boundary.ts
 *   quarto run --dev tools/check-runtime-boundary.ts --update-baseline
 *   quarto run --dev tools/check-runtime-boundary.ts --update-baseline --accept-tests-increase
 *   quarto run --dev tools/check-runtime-boundary.ts --root /path/to/quarto-cli
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { existsSync, walkSync } from "../src/deno_ral/fs.ts";
import { join, relative } from "../src/deno_ral/path.ts";

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
  const deno: Record<string, number> = {};
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

export function acceptTestsIncrease(
  current: Baseline,
  baseline: Baseline,
): Baseline {
  const result = lowerBaseline(current, baseline);
  if (current["tests"]) {
    result["tests"] = { ...current["tests"] };
  }
  return result;
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
  const acceptTests = args.includes("--accept-tests-increase");

  if (acceptTests && !update) {
    console.error(
      "check-runtime-boundary: --accept-tests-increase is only valid with --update-baseline",
    );
    Deno.exit(2);
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
    const next = acceptTests
      ? acceptTestsIncrease(current, baseline)
      : lowerBaseline(current, baseline);
    if (acceptTests && baseline["tests"]) {
      for (const field of kFields) {
        if (next["tests"][field] > baseline["tests"][field]) {
          console.log(
            `::warning::tests baseline raised from ${baseline["tests"][field]} to ${
              next["tests"][field]
            } (${kFieldLabels[field]}); list the new test files in the PR description`,
          );
        }
      }
    }
    Deno.writeTextFileSync(baselinePath, JSON.stringify(next, null, 2) + "\n");
    console.log(`Baseline written to ${kBaselineRelPath}`);
    Deno.exit(0);
  }

  const { regressions, improvements } = compareToBaseline(current, baseline);
  for (const line of improvements) {
    console.log(
      `::notice::${line}; run 'quarto run --dev tools/check-runtime-boundary.ts --update-baseline' and commit ${kBaselineRelPath}`,
    );
  }
  if (regressions.length > 0) {
    for (const line of regressions) {
      console.log(
        `::error::${line} (baseline ${kBaselineRelPath}). Application code must use src/deno_ral/ instead of Deno.* or direct std imports; see dev-docs/runtime-migration/README.md`,
      );
    }
    Deno.exit(1);
  }
  console.log("OK: no count exceeds the baseline.");
}
