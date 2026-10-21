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
import { assert, assertEquals, assertThrows } from "../../asserts.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { ensureDirSync } from "../../../src/deno_ral/fs.ts";
import { createTempContext } from "../../../src/core/temp.ts";
import {
  acceptTestsIncrease,
  compareToBaseline,
  countScope,
  hasStdImport,
  kScopes,
  lowerBaseline,
  measure,
  parseBaseline,
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
unitTest("check-runtime-boundary - acceptTestsIncrease raises tests only", async () => {
  const baseline = { "src": { denoCalls: 10, stdImportFiles: 3 }, "tests": { denoCalls: 5, stdImportFiles: 1 } };
  assertEquals(
    acceptTestsIncrease({ "src": { denoCalls: 12, stdImportFiles: 1 }, "tests": { denoCalls: 7, stdImportFiles: 2 } }, baseline),
    { "src": { denoCalls: 10, stdImportFiles: 1 }, "tests": { denoCalls: 7, stdImportFiles: 2 } },
  );
});
