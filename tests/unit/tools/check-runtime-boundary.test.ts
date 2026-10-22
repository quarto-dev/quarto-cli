/*
 * check-runtime-boundary.test.ts
 *
 * Unit tests for the runtime boundary ratchet (tools/check-runtime-boundary.ts).
 * The fixture repository is written to a temp directory so the tests do not
 * depend on the real counts.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import { assert, assertEquals, assertRejects, assertThrows } from "../../asserts.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { ensureDirSync, safeRemoveSync } from "../../../src/deno_ral/fs.ts";
import { execProcess } from "../../../src/core/process.ts";
import { createTempContext } from "../../../src/core/temp.ts";
import {
  acceptIncrease,
  compareToBaseline,
  countScope,
  countText,
  denoReplacement,
  diffChanges,
  type FileChange,
  gitChanges,
  hasStdImport,
  kRalDenoReplacements,
  kScopes,
  lowerBaseline,
  measure,
  parseAddedLines,
  parseBaseline,
  renderDelta,
  scopesOf,
  stdModuleOf,
  stdSuggestion,
} from "../../../tools/check-runtime-boundary.ts";

// Built at runtime so this file's text is not counted by the ratchet itself.
const DENO = ["De", "no"].join("") + ".";
const FROM = ["fr", "om"].join("");
const IMPORT = ["im", "port"].join("");

function writeFixture(root: string, rel: string, contents: string) {
  const parts = rel.split("/");
  ensureDirSync(join(root, ...parts.slice(0, -1)));
  Deno.writeTextFileSync(join(root, ...parts), contents);
}

function makeRepo(root: string) {
  writeFixture(root, "src/quarto.ts", "export {};\n");
  // src: 2 calls, 1 std file (import-map name, double quotes)
  writeFixture(
    root,
    "src/command/a.ts",
    `import { blue } ${FROM} "fmt/colors";\nconst x = ${DENO}cwd();\nconst y = ${DENO}env.get("X");\nconsole.log(blue(x), y);\n`,
  );
  // "DenoX." must not match \bDeno\.
  writeFixture(root, "src/core/b.ts", "const DenoX = { a: 1 }; console.log(DenoX.a);\n");
  // std file: full deno.land/std URL in single quotes
  writeFixture(root, "src/core/c.ts", `import { assertObjectMatch } ${FROM} 'https://deno.land/std@0.93.0/assert/assert_object_match.ts';\n`);
  // std file: dynamic jsr:@std import
  writeFixture(root, "src/core/d.ts", `const p = await ${IMPORT}("jsr:@std/path@1.0.8");\nexport { p };\n`);
  // not std: deno.land/x package and the semver import-map name
  writeFixture(root, "src/core/e.ts", `import { satisfies } ${FROM} "semver/mod.ts";\nimport { stringify } ${FROM} "https://deno.land/x/xml@2.1.1/mod.ts";\n`);
  // not std: commented-out import
  writeFixture(root, "src/core/f.ts", `// import { assert } ${FROM} "jsr:@std/assert";\nexport const f = 1;\n`);
  // std file: the http/ import-map key
  writeFixture(root, "src/core/g.ts", `import { serveDir } ${FROM} "http/file-server";\n`);
  // not counted: allow-listed import-map seams only (the std boundary rule)
  writeFixture(root, "src/core/h.ts", `import { delay } ${FROM} "async";\nimport { getLogger } ${FROM} "log";\nimport { readAll } ${FROM} "io/read-all";\nimport { sprintf } ${FROM} "fmt/printf";\n`);
  // std file: log/file-handler is the counted exception under the log/ prefix
  writeFixture(root, "src/core/i.ts", `import { FileHandler } ${FROM} "log/file-handler";\n`);
  // R01 "Later validation": a forbidden filesystem import (1 std file) next to a call (1 call), in a helper...
  writeFixture(root, "src/core/helper.ts", `import { exists } ${FROM} "fs/exists";\nexport const cwd = () => ${DENO}cwd();\nexport { exists };\n`);
  // ...and the importer of that helper: an indirect Deno dependency the textual rule does not see (0 calls, 0 std files)
  writeFixture(root, "src/core/indirect.ts", `import { cwd, exists } ${FROM} "./helper.ts";\nexport const here = cwd();\nexport const ok = exists(here);\n`);
  // excluded from src
  writeFixture(root, "src/deno_ral/c.ts", `import { walk } ${FROM} "fs/walk";\n${DENO}cwd();\n`);
  writeFixture(root, "src/vendor/d.ts", `${DENO}cwd();\n`);
  writeFixture(root, "src/resources/extension-subtrees/julia-engine/src/j.ts", `import { exists } ${FROM} "fs/exists";\n${DENO}cwd();\n`);
  writeFixture(root, "src/resources/extension-subtrees/julia-engine/_extensions/j.js", `${DENO}cwd();\n`);
  writeFixture(root, "src/webui/quarto-preview/build.ts", `${DENO}cwd();\n`);
  // a sibling of the excluded file is counted in src
  writeFixture(root, "src/webui/quarto-preview/m.ts", `${DENO}cwd();\n`);
  // src-js
  writeFixture(root, "src/e.js", `${DENO}cwd();\n`);
  // resources: .js anywhere, .ts only under scripts/ and create/
  writeFixture(root, "src/resources/js/r.js", `import { join } ${FROM} "https://deno.land/std/path/mod.ts";\n${DENO}env.get("X");\n`);
  writeFixture(root, "src/resources/scripts/k.ts", `${DENO}cwd();\n`);
  writeFixture(root, "src/resources/create/l.ejs.ts", `${DENO}cwd();\n`);
  writeFixture(root, "src/resources/deno_std/cache/npm/x.js", `${DENO}cwd();\n`);
  // skipped tree
  writeFixture(root, "src/webui/node_modules/f.ts", `${DENO}cwd();\n`);
  // package/src: g.ts imports an allow-listed module only (not counted); h.ts a counted one
  writeFixture(root, "package/src/g.ts", `import { readAll } ${FROM} "io/read_all";\n${DENO}exit(0);\n`);
  writeFixture(root, "package/src/h.ts", `import { walk } ${FROM} "fs/walk";\n`);
  // tests: 1 call, 2 std files; tests/docs and tests/asserts.ts excluded
  writeFixture(root, "tests/h.test.ts", `import { assert } ${FROM} "testing/asserts";\nimport { x } ${FROM} "@std/path";\n`);
  writeFixture(root, "tests/i.test.ts", `import { y } ${FROM} "https://deno.land/std@0.93.0/assert/mod.ts";\n${DENO}cwd();\n`);
  writeFixture(root, "tests/asserts.ts", `export { assert } ${FROM} "testing/asserts";\n`);
  writeFixture(root, "tests/docs/prepost/pre.ts", `${DENO}cwd();\n`);
}

const kExpected = {
  "src": { denoCalls: 4, stdImportFiles: 6 },
  "src-js": { denoCalls: 1, stdImportFiles: 0 },
  "resources": { denoCalls: 3, stdImportFiles: 1 },
  "package/src": { denoCalls: 1, stdImportFiles: 1 },
  "tests": { denoCalls: 1, stdImportFiles: 2 },
};

// deno-lint-ignore require-await
unitTest("check-runtime-boundary - countScope counts each scope of the fixture", async () => {
  const temp = createTempContext();
  try {
    const root = temp.createDir();
    makeRepo(root);
    for (const [name, spec] of Object.entries(kScopes)) {
      assertEquals(
        countScope(root, spec),
        kExpected[name as keyof typeof kExpected],
        `scope ${name}`,
      );
    }
  } finally {
    temp.cleanup();
  }
});

// deno-lint-ignore require-await
unitTest("check-runtime-boundary - measure returns the five scopes in order", async () => {
  const temp = createTempContext();
  try {
    const root = temp.createDir();
    makeRepo(root);
    const result = measure(root);
    assertEquals(Object.keys(result), ["src", "src-js", "resources", "package/src", "tests"]);
    assertEquals(result, kExpected);
  } finally {
    temp.cleanup();
  }
});

// deno-lint-ignore require-await
unitTest("check-runtime-boundary - hasStdImport covers URLs, jsr, quotes, http/, skips comments and the allow-list", async () => {
  const yes = [
    `import { FileHandler } ${FROM} "log/file-handler";`,
    `import { load } ${FROM} "dotenv";`,
    `import { blue } ${FROM} "fmt/colors";`,
    `import { blue } ${FROM} 'fmt/colors';`,
    `import { a } ${FROM} "https://deno.land/std@0.93.0/assert/assert_object_match.ts";`,
    `import { join } ${FROM} "https://deno.land/std/path/mod.ts";`,
    `const p = await ${IMPORT}("https://deno.land/std/path/mod.ts");`,
    `import { brightBlue } ${FROM} "jsr:/@std/fmt@^0.224.0/colors";`,
    `import { assert } ${FROM} "jsr:@std/assert";`,
    `import { serveDir } ${FROM} "http/file-server";`,
    `import { x } ${FROM} "@std/path";`,
    `import { assert } ${FROM} "@std/assert";`,
    `import {\n  exists,\n} ${FROM} "fs/exists";`,
    `export { walk } ${FROM} "fs/walk";`,
  ];
  const no = [
    `import { satisfies } ${FROM} "semver/mod.ts";`,
    `import { SAXParser } ${FROM} "xmlp/mod.ts";`,
    `import x ${FROM} "https://deno.land/x/cliffy@v1.0.0-rc.3/command/mod.ts";`,
    `import { join } ${FROM} "./path.ts";`,
    `import fs ${FROM} "node:fs";`,
    `import { delay } ${FROM} "async";`,
    `import { crypto } ${FROM} "crypto/crypto";`,
    `import { parse } ${FROM} "datetime/parse";`,
    `import { TextLineStream } ${FROM} "streams/text-line-stream";`,
    `import { readAll } ${FROM} "io/read-all";`,
    `import { getLogger } ${FROM} "log";`,
    `import { BaseHandler } ${FROM} "log/base-handler";`,
    `import { sprintf } ${FROM} "fmt/printf";`,
    `import { stringify } ${FROM} "dotenv/stringify";`,
    `// import { assert } ${FROM} "jsr:@std/assert";`,
    ` * import { bgBlue } ${FROM} "https://deno.land/std@$STD_VERSION/fmt/colors";`,
  ];
  for (const text of yes) assert(hasStdImport(text), `expected std import: ${text}`);
  for (const text of no) assert(!hasStdImport(text), `expected no std import: ${text}`);
});

// deno-lint-ignore require-await
unitTest("check-runtime-boundary - an indirect Deno dependency is counted at the helper, not at its importer", async () => {
  // The std boundary rule is textual (Context): src/core/indirect.ts in the fixture imports ./helper.ts,
  // which calls Deno and imports fs/exists. In a repository holding the importer alone, src counts nothing;
  // the helper is what the fixture's kExpected.src counts (its 1 call and 1 std file are in the 4 and 6).
  const temp = createTempContext();
  try {
    const root = temp.createDir();
    writeFixture(root, "src/quarto.ts", "export {};\n");
    writeFixture(root, "src/core/indirect.ts", `import { cwd, exists } ${FROM} "./helper.ts";\nexport const here = cwd();\nexport const ok = exists(here);\n`);
    assertEquals(countScope(root, kScopes["src"]), { denoCalls: 0, stdImportFiles: 0 });
  } finally {
    temp.cleanup();
  }
});

// deno-lint-ignore require-await
unitTest("check-runtime-boundary - compareToBaseline reports regressions and improvements", async () => {
  const baseline = {
    "src": { denoCalls: 10, stdImportFiles: 3 },
    "tests": { denoCalls: 5, stdImportFiles: 1 },
  };
  const current = {
    "src": { denoCalls: 11, stdImportFiles: 2 },
    "tests": { denoCalls: 5, stdImportFiles: 1 },
  };
  assertEquals(compareToBaseline(current, baseline), {
    regressions: [`src: ${DENO}* calls rose from 10 to 11`],
    improvements: ["src: std-import files fell from 3 to 2"],
  });
  assertEquals(compareToBaseline(baseline, baseline), { regressions: [], improvements: [] });
});

// deno-lint-ignore require-await
unitTest("check-runtime-boundary - hasStdImport sees every import, not only the first on a line", async () => {
  const yes = [
    `${IMPORT} { delay } ${FROM} "async"; ${IMPORT} { blue } ${FROM} "fmt/colors";`,
    `${IMPORT} { blue }\n  ${FROM}\n  "fmt/colors";`,
    `${IMPORT} { delay } ${FROM} "async";\n${IMPORT} {\n  blue,\n} ${FROM}\n"fmt/colors";`,
    `// ${IMPORT} { x } ${FROM} "fmt/colors"\n${IMPORT} { blue } ${FROM} "fmt/colors";`,
  ];
  const no = [
    `${IMPORT} { delay } ${FROM} "async"; ${IMPORT} { sleep } ${FROM} "log";`,
    `${IMPORT} { delay }\n  ${FROM}\n  "async";`,
    `// ${IMPORT} { blue } ${FROM} "fmt/colors"\n${IMPORT} { delay } ${FROM} "async";`,
  ];
  for (const text of yes) assert(hasStdImport(text), `expected std import: ${text}`);
  for (const text of no) assert(!hasStdImport(text), `expected no std import: ${text}`);
});

// deno-lint-ignore require-await
unitTest("check-runtime-boundary - parseBaseline accepts a complete baseline", async () => {
  const baseline = { "src": { denoCalls: 3, stdImportFiles: 0 }, "tests": { denoCalls: 0, stdImportFiles: 2 } };
  assertEquals(parseBaseline(JSON.stringify(baseline)), baseline);
});

// deno-lint-ignore require-await
unitTest("check-runtime-boundary - parseBaseline rejects a scope with a missing, negative or non-integer count", async () => {
  const malformed = [
    `{"src":{"denoCalls":0}}`,
    `{"src":{"stdImportFiles":0}}`,
    `{"src":{"denoCalls":-1,"stdImportFiles":0}}`,
    `{"src":{"denoCalls":1.5,"stdImportFiles":0}}`,
    `{"src":{"denoCalls":"3","stdImportFiles":0}}`,
    `{"src":null}`,
    `[]`,
    `null`,
  ];
  for (const text of malformed) {
    assertThrows(() => parseBaseline(text), Error, "baseline", `expected rejection: ${text}`);
  }
});

// deno-lint-ignore require-await
unitTest("check-runtime-boundary - a scope missing from the baseline is a regression", async () => {
  assertEquals(compareToBaseline({ "src-js": { denoCalls: 1, stdImportFiles: 0 } }, {}), {
    regressions: [`src-js: ${DENO}* calls rose from 0 to 1`],
    improvements: [],
  });
});

// deno-lint-ignore require-await
unitTest("check-runtime-boundary - lowerBaseline never raises a number", async () => {
  const baseline = { "src": { denoCalls: 10, stdImportFiles: 3 }, "tests": { denoCalls: 5, stdImportFiles: 1 } };
  assertEquals(
    lowerBaseline({ "src": { denoCalls: 12, stdImportFiles: 1 }, "tests": { denoCalls: 7, stdImportFiles: 1 } }, baseline),
    { "src": { denoCalls: 10, stdImportFiles: 1 }, "tests": { denoCalls: 5, stdImportFiles: 1 } },
  );
});

// deno-lint-ignore require-await
unitTest("check-runtime-boundary - acceptIncrease writes the current counts", async () => {
  const current = { "src": { denoCalls: 12, stdImportFiles: 1 }, "tests": { denoCalls: 7, stdImportFiles: 2 } };
  assertEquals(acceptIncrease(current), current);
  assert(acceptIncrease(current) !== current, "returns a copy");
});

// deno-lint-ignore require-await
unitTest("check-runtime-boundary - countText keys Deno APIs by one or two identifiers", async () => {
  const text = [
    DENO + "build.os",
    DENO + "build.target",
    DENO + "readTextFileSync(p)",
    DENO + "readTextFileSync(q)",
    DENO + "\n",
  ].join("\n");
  assertEquals(countText(text).deno, { "build.os": 1, "build.target": 1, readTextFileSync: 2, "": 1 });
});

// deno-lint-ignore require-await
unitTest("check-runtime-boundary - countText never swallows a following prefix", async () => {
  assertEquals(countText(DENO + DENO + "build.os").deno, { [DENO + "build"]: 1, "build.os": 1 });
});

// deno-lint-ignore require-await
unitTest("check-runtime-boundary - countText lists counted std specifiers, not allow-listed ones", async () => {
  const text = [
    `${IMPORT} { ensureDir } ${FROM} "fs/ensure-dir";`,
    `${IMPORT} { delay } ${FROM} "async";`,
    `${IMPORT} * as path ${FROM} "path";`,
    `${IMPORT} type { WalkEntry } ${FROM} "jsr:@std/fs";`,
  ].join("\n");
  assertEquals(countText(text).std, ["fs/ensure-dir", "path", "jsr:@std/fs"]);
});

// deno-lint-ignore require-await
unitTest("check-runtime-boundary - stdModuleOf normalises every specifier form", async () => {
  assertEquals(stdModuleOf("fs/ensure-dir"), "fs");
  assertEquals(stdModuleOf("@std/fs"), "fs");
  assertEquals(stdModuleOf("jsr:@std/fs@1.0.16/walk"), "fs");
  assertEquals(stdModuleOf("testing/asserts"), "testing");
  assertEquals(stdModuleOf("jsr:/@std/assert"), "assert");
  assertEquals(stdModuleOf("https://deno.land/std@0.93.0/assert/assert_object_match.ts"), "assert");
  assertEquals(stdModuleOf("@std/path"), "path");
  assertEquals(stdModuleOf("path"), "path");
});

// deno-lint-ignore require-await
unitTest("check-runtime-boundary - scopesOf follows each scope's rules", async () => {
  assertEquals(scopesOf("src/core/a.ts"), ["src"]);
  assertEquals(scopesOf("src/resources/scripts/x.ts"), ["resources"]);
  assertEquals(scopesOf("src/resources/formats/html/a.js"), ["resources"]);
  assertEquals(scopesOf("src/x.js"), ["src-js"]);
  assertEquals(scopesOf("tests/docs/a.ts"), []);
  assertEquals(scopesOf("tests/unit/a.test.ts"), ["tests"]);
  assertEquals(scopesOf("src/vendor/a.ts"), []);
  assertEquals(scopesOf("tests/node_modules/a.ts"), []);
});

const imp = (specifier: string) => `${IMPORT} { x } ${FROM} "${specifier}";\n`;

// deno-lint-ignore require-await
unitTest("check-runtime-boundary - stdSuggestion by module, scope-limited", async () => {
  assertEquals(stdSuggestion("testing/asserts", "tests"), "tests/asserts.ts");
  assertEquals(stdSuggestion("testing/asserts", "src"), undefined);
  assertEquals(stdSuggestion("jsr:@std/fs@1.0.16/walk", "src"), "src/deno_ral/fs.ts");
  assertEquals(stdSuggestion("fs/walk", "src"), "src/deno_ral/fs.ts");
  assertEquals(stdSuggestion("fmt/colors", "src"), undefined);
});

// deno-lint-ignore require-await
unitTest("check-runtime-boundary - denoReplacement exact keys only", async () => {
  assertEquals(denoReplacement("build.os", "src"), kRalDenoReplacements["build.os"].hint);
  assertEquals(denoReplacement("build.target", "src"), undefined);
  assertEquals(denoReplacement("build", "src"), undefined);
});

// deno-lint-ignore require-await
unitTest("check-runtime-boundary - diffChanges an uncovered increase is a finding without replacement", async () => {
  const changes: FileChange[] = [{
    path: "tests/unit/a.test.ts",
    before: "",
    after: `\n\n${DENO}mkdirSync(x)\n\n${DENO}mkdirSync(y)\n`,
    addedLines: [3, 5],
  }];
  const report = diffChanges(changes);
  assertEquals(report.deltas["tests"].denoCalls, 2);
  assertEquals(report.findings, [
    { scope: "tests", file: "tests/unit/a.test.ts", kind: "deno", name: "mkdirSync", delta: 2, line: 3 },
  ]);
});

// deno-lint-ignore require-await
unitTest("check-runtime-boundary - diffChanges a covered increase carries the replacement", async () => {
  const report = diffChanges([
    { path: "src/core/a.ts", before: "", after: `export const o = ${DENO}build.os;\n`, addedLines: [1] },
  ]);
  assertEquals(report.findings.length, 1);
  assertEquals(report.findings[0].replacement, kRalDenoReplacements["build.os"].hint);
});

// deno-lint-ignore require-await
unitTest("check-runtime-boundary - diffChanges a renamed file is net zero", async () => {
  const text = `${DENO}cwd();\n${DENO}pid;\n`;
  const report = diffChanges([
    { path: "src/a.ts", before: text, after: null, addedLines: [] },
    { path: "src/b.ts", before: null, after: text, addedLines: [1, 2] },
  ]);
  assertEquals(report.deltas["src"].denoCalls, 0);
  assertEquals(report.findings, []);
});

// deno-lint-ignore require-await
unitTest("check-runtime-boundary - diffChanges a moved covered call does not hide behind an unrelated increase", async () => {
  const os = `${DENO}build.os;\n`;
  const report = diffChanges([
    { path: "src/a.ts", before: os, after: "", addedLines: [] },
    { path: "src/b.ts", before: null, after: `${os}${DENO}cwd();\n`, addedLines: [1, 2] },
  ]);
  assertEquals(report.findings.length, 1);
  assertEquals(report.findings[0].name, "cwd");
  assertEquals(report.findings[0].replacement, undefined);
});

// deno-lint-ignore require-await
unitTest("check-runtime-boundary - diffChanges a file moved into an excluded path lowers the count", async () => {
  const text = `${DENO}cwd();\n`;
  const report = diffChanges([
    { path: "tests/unit/x.ts", before: text, after: null, addedLines: [] },
    { path: "tests/docs/x.ts", before: null, after: text, addedLines: [1] },
  ]);
  assertEquals(report.deltas["tests"].denoCalls, -1);
  assertEquals(report.findings, []);
});

// deno-lint-ignore require-await
unitTest("check-runtime-boundary - diffChanges every module a newly counted file imports is reported, never as an error", async () => {
  const report = diffChanges([
    { path: "src/core/a.ts", before: "export {};\n", after: imp("fmt/colors") + imp("path"), addedLines: [1, 2] },
  ]);
  assertEquals(report.deltas["src"].stdImportFiles, 1);
  assertEquals(report.findings, [
    { scope: "src", file: "src/core/a.ts", kind: "std", name: "fmt/colors", delta: 1, line: 1 },
    { scope: "src", file: "src/core/a.ts", kind: "std", name: "path", delta: 1, line: 2, suggestion: "src/deno_ral/path.ts" },
  ]);
});

// deno-lint-ignore require-await
unitTest("check-runtime-boundary - diffChanges a moved std import nets out", async () => {
  const report = diffChanges([
    { path: "src/a.ts", before: imp("path"), after: "", addedLines: [] },
    { path: "src/b.ts", before: null, after: imp("path"), addedLines: [1] },
    { path: "src/c.ts", before: null, after: imp("fmt/colors"), addedLines: [1] },
  ]);
  assertEquals(report.deltas["src"].stdImportFiles, 1);
  assertEquals(report.findings.length, 1);
  assertEquals(report.findings[0].name, "fmt/colors");
});

// deno-lint-ignore require-await
unitTest("check-runtime-boundary - diffChanges an import split across more files still reports", async () => {
  const report = diffChanges([
    { path: "src/a.ts", before: imp("path") + imp("fs/exists"), after: imp("path"), addedLines: [] },
    { path: "src/b.ts", before: null, after: imp("fs/exists"), addedLines: [1] },
  ]);
  assertEquals(report.deltas["src"].stdImportFiles, 1);
  assertEquals(report.findings.length, 1);
  assertEquals(report.findings[0].file, "src/b.ts");
  assertEquals(report.findings[0].name, "fs/exists");
});

const kUncoveredWarning = (scope: string, n: number, api: string, file: string) =>
  `${scope}: +${n} ${DENO}${api} in ${file}; src/deno_ral has no replacement yet, so nothing to change in this PR. A maintainer accepts the new count before merging (see the job summary).`;

// deno-lint-ignore require-await
unitTest("check-runtime-boundary - renderDelta uncovered increases: warnings and maintainer block, not failed", async () => {
  const current = { "tests": { denoCalls: 832, stdImportFiles: 177 } };
  const rendered = renderDelta(
    {
      deltas: { "tests": { denoCalls: 6, stdImportFiles: 0 } },
      findings: [
        { scope: "tests", file: "tests/unit/a.test.ts", kind: "deno", name: "writeTextFileSync", delta: 4 },
        { scope: "tests", file: "tests/unit/b.test.ts", kind: "deno", name: "mkdirSync", delta: 2 },
      ],
    },
    current,
    { "tests": { denoCalls: 826, stdImportFiles: 177 } },
  );
  assertEquals(rendered.failed, false);
  assertEquals(rendered.errors, []);
  assertEquals(rendered.notices, []);
  assertEquals(rendered.warnings.map((w) => w.message), [
    kUncoveredWarning("tests", 4, "writeTextFileSync", "tests/unit/a.test.ts"),
    kUncoveredWarning("tests", 2, "mkdirSync", "tests/unit/b.test.ts"),
  ]);
  assert(rendered.summary.includes("| tests | +6 | 0 |"));
  assert(rendered.summary.includes("### Maintainer action before merging"));
  assert(rendered.summary.includes("Expected counts after merge: tests 832 / 177."));
  assert(!rendered.summary.includes("### What to change"));
});

// deno-lint-ignore require-await
unitTest("check-runtime-boundary - renderDelta covered increase: error with line, failed", async () => {
  const hint = kRalDenoReplacements["build.os"].hint;
  const rendered = renderDelta(
    {
      deltas: { "src": { denoCalls: 1, stdImportFiles: 0 } },
      findings: [
        { scope: "src", file: "src/core/x.ts", kind: "deno", name: "build.os", delta: 1, line: 12, replacement: hint },
      ],
    },
    { "src": { denoCalls: 995, stdImportFiles: 49 } },
    { "src": { denoCalls: 994, stdImportFiles: 49 } },
  );
  assertEquals(rendered.failed, true);
  assertEquals(rendered.errors[0], {
    message: `src: +1 ${DENO}build.os in src/core/x.ts; use os (or isWindows, isMac, isLinux) from src/deno_ral/platform.ts instead (runtime boundary, see dev-docs/runtime-migration/README.md)`,
    file: "src/core/x.ts",
    line: 12,
  });
  assert(rendered.summary.includes("### What to change"));
  assert(
    rendered.summary.includes(
      `- \`src/core/x.ts\` line 12: use os (or isWindows, isMac, isLinux) from src/deno_ral/platform.ts instead of ${DENO}build.os`,
    ),
  );
});

// deno-lint-ignore require-await
unitTest("check-runtime-boundary - renderDelta a std import with a suggestion is a warning naming the module", async () => {
  const rendered = renderDelta(
    {
      deltas: { "tests": { denoCalls: 0, stdImportFiles: 1 } },
      findings: [
        { scope: "tests", file: "tests/unit/c.test.ts", kind: "std", name: "testing/asserts", delta: 1, suggestion: "tests/asserts.ts" },
      ],
    },
    { "tests": { denoCalls: 832, stdImportFiles: 178 } },
    { "tests": { denoCalls: 832, stdImportFiles: 177 } },
  );
  assertEquals(rendered.failed, false);
  assertEquals(rendered.warnings.map((w) => w.message), [
    "tests: tests/unit/c.test.ts now imports the standard library directly (testing/asserts); if tests/asserts.ts exports what this file uses with the same behaviour, import it from there. Otherwise nothing to change in this PR: a maintainer accepts the new count before merging (see the job summary).",
  ]);
});

// deno-lint-ignore require-await
unitTest("check-runtime-boundary - renderDelta main above baseline, PR adds nothing", async () => {
  const rendered = renderDelta(
    { deltas: { "tests": { denoCalls: 0, stdImportFiles: 0 } }, findings: [] },
    { "tests": { denoCalls: 832, stdImportFiles: 177 } },
    { "tests": { denoCalls: 826, stdImportFiles: 177 } },
  );
  assertEquals(rendered.failed, false);
  assertEquals(rendered.errors, []);
  assertEquals(rendered.warnings, []);
  assertEquals(rendered.notices, [
    `main is above tools/runtime-boundary-baseline.json (tests ${DENO}* calls 832 > 826); not caused by this PR, a maintainer fixes main`,
  ]);
  assert(rendered.summary.includes("No count changed in this PR."));
});

// deno-lint-ignore require-await
unitTest("check-runtime-boundary - inherited property names count as ordinary Deno API keys", async () => {
  const text = `// ${DENO}constructor\n// ${DENO}__proto__\n${DENO}build.os;\n`;
  const counts = countText(text).deno;
  assertEquals(counts["constructor"], 1);
  assertEquals(counts["__proto__"], 1);
  assertEquals(counts["build.os"], 1);

  const report = diffChanges([{ path: "src/a.ts", before: null, after: text, addedLines: [1, 2, 3] }]);
  assertEquals(report.deltas["src"].denoCalls, 3);
  assertEquals(report.findings.find((f) => f.name === "build.os")?.replacement, kRalDenoReplacements["build.os"].hint);
  assertEquals(renderDelta(report, { "src": { denoCalls: 3, stdImportFiles: 0 } }, {}).failed, true);
});

// deno-lint-ignore require-await
unitTest("check-runtime-boundary - parseAddedLines reads hunk headers", async () => {
  const diff = [
    "diff --git a/src/a.ts b/src/a.ts",
    "--- a/src/a.ts",
    "+++ b/src/a.ts",
    "@@ -3,0 +4,2 @@",
    "+x",
    "+y",
    "@@ -10 +12 @@",
    "-old",
    "+new",
    "@@ -20,3 +23,0 @@",
    "-a",
    "-b",
    "-c",
  ].join("\n");
  assertEquals(parseAddedLines(diff), [4, 5, 12]);
});

async function git(root: string, ...args: string[]): Promise<void> {
  const result = await execProcess({ cmd: "git", args, cwd: root, stdout: "piped", stderr: "piped" });
  assert(result.success, `git ${args.join(" ")} failed: ${result.stderr}`);
}

async function makeGitRepo(root: string) {
  writeFixture(root, "src/quarto.ts", "export {};\n");
  writeFixture(root, "src/a.ts", "export const a = 1;\n");
  writeFixture(root, "src/gone.ts", "export const gone = 1;\n");
  await git(root, "init");
  await git(root, "add", ".");
  await git(root, "-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "commit.gpgsign=false", "commit", "-m", "init");
}

unitTest("check-runtime-boundary - gitChanges tracked, deleted and untracked files, verbatim paths", async () => {
  const temp = createTempContext();
  try {
    const root = temp.createDir();
    await makeGitRepo(root);
    writeFixture(root, "src/a.ts", "export const a = 1;\nexport const b = 2;\n");
    safeRemoveSync(join(root, "src", "gone.ts"));
    writeFixture(root, "tests/unit/new.test.ts", "a\nb\nc\n");
    writeFixture(root, "src/café.ts", "export const c = 1;\n");

    const changes = await gitChanges(root, "HEAD");
    const byPath = Object.fromEntries(changes.map((c) => [c.path, c]));
    assertEquals(Object.keys(byPath).sort(), ["src/a.ts", "src/café.ts", "src/gone.ts", "tests/unit/new.test.ts"]);
    assertEquals(changes.filter((c) => c.before === null).map((c) => c.path).sort(), ["src/café.ts", "tests/unit/new.test.ts"]);
    assertEquals(changes.filter((c) => c.after === null).map((c) => c.path), ["src/gone.ts"]);
    assertEquals(byPath["src/a.ts"].before, "export const a = 1;\n");
    assertEquals(byPath["src/a.ts"].addedLines, [2]);
    assertEquals(byPath["tests/unit/new.test.ts"].addedLines, [1, 2, 3]);
    assertEquals(byPath["src/café.ts"].addedLines, [1]);
  } finally {
    temp.cleanup();
  }
});

unitTest("check-runtime-boundary - gitChanges unknown revision", async () => {
  const temp = createTempContext();
  try {
    const root = temp.createDir();
    await makeGitRepo(root);
    await assertRejects(
      () => gitChanges(root, "no-such-rev"),
      Error,
      "check-runtime-boundary: no-such-rev is not a commit",
    );
  } finally {
    temp.cleanup();
  }
});

unitTest("check-runtime-boundary - gitChanges handles more changed paths than fit on one command line", async () => {
  const temp = createTempContext();
  try {
    const root = temp.createDir();
    await makeGitRepo(root);
    const names = Array.from({ length: 300 }, (_, i) => `tests/unit/${"a".repeat(120)}${i}.test.ts`);
    for (const name of names) {
      writeFixture(root, name, "export {};\n");
    }
    const changes = await gitChanges(root, "HEAD");
    assertEquals(changes.map((c) => c.path).sort(), [...names].sort());
  } finally {
    temp.cleanup();
  }
});
