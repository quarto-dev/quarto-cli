/*
 * codemod-deno-ral.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Contract for tools/codemod-deno-ral.ts. Lives under tools/, not tests/, so
 * that run-tests.sh never loads npm:ts-morph; CI runs it in the
 * runtime-boundary workflow:
 *   package/dist/bin/tools/x86_64/deno test --allow-all --import-map=src/import_map.json tools/codemod/
 */

import { assert, assertEquals } from "testing/asserts";
import { dirname, fromFileUrl, join, relative } from "../../src/deno_ral/path.ts";
import {
  codemodFile,
  type CodemodResult,
  collectFiles,
  kCanonicalReverseHint,
  type RuleName,
} from "../codemod-deno-ral.ts";

const fixtures = join(dirname(fromFileUrl(import.meta.url)), "fixtures");
const read = (name: string) => Deno.readTextFileSync(join(fixtures, name));

// Copy a fixture to <tmp>/src/core/<name>.ts so that the import path to the
// (fake) <tmp>/src/deno_ral is "../deno_ral/<module>.ts", then run the codemod.
function run(
  name: string,
  rules: RuleName[],
  opts: { reverse?: boolean; input?: string } = {},
): { result: CodemodResult; output: string } {
  const tmp = Deno.makeTempDirSync({ prefix: "codemod-" });
  try {
    const target = join(tmp, "src", "core", `${name}.ts`);
    Deno.mkdirSync(dirname(target), { recursive: true });
    Deno.copyFileSync(join(fixtures, opts.input ?? `${name}.input.ts`), target);
    const result = codemodFile(target, rules, {
      ralDir: join(tmp, "src", "deno_ral"),
      dryRun: false,
      reverse: opts.reverse,
    });
    return { result, output: Deno.readTextFileSync(target) };
  } finally {
    Deno.removeSync(tmp, { recursive: true });
  }
}

Deno.test("codemod - fs calls and types with a new import", () => {
  const { result, output } = run("fs-basic", ["fs"]);
  assertEquals(output, read("fs-basic.expected.ts"));
  assertEquals(result.replacements.length, 4);
  assertEquals(result.collisions, []);
  assertEquals(result.importsAdded, {
    "fs.ts": ["FileInfo", "lstatSync", "readTextFileSync", "statSync"],
  });
});

Deno.test("codemod - a local binding blocks only that name", () => {
  const { result, output } = run("fs-collision", ["fs"]);
  assertEquals(output, read("fs-collision.expected.ts"));
  assertEquals(result.collisions, [{ name: "remove", line: 3, module: "fs.ts" }]);
  assertEquals(result.replacements.length, 1);
});

Deno.test("codemod - merges into an existing deno_ral import", () => {
  const { result, output } = run("existing-import", ["fs"]);
  assertEquals(output, read("existing-import.expected.ts"));
  assertEquals(result.importsAdded, { "fs.ts": ["statSync"] });
});

Deno.test("codemod - keeps an existing alias and reuses it", () => {
  const { result, output } = run("existing-alias", ["platform"]);
  assertEquals(output, read("existing-alias.expected.ts"));
  assertEquals(result.replacements.length, 2);
  assertEquals(result.importsAdded, { "platform.ts": ["arch"] });
});

Deno.test("codemod - leaves an import type declaration type-only", () => {
  const { output } = run("type-only-existing", ["fs"]);
  assertEquals(output, read("type-only-existing.expected.ts"));
});

Deno.test("codemod - an existing layer import is not a collision (idempotent)", () => {
  const { result, output } = run("already-migrated", ["fs"]);
  assertEquals(output, read("already-migrated.expected.ts"));
  assertEquals(result.collisions, []);
  assertEquals(result.importsAdded, {});
  const again = run("already-migrated", ["fs"], { input: "already-migrated.expected.ts" });
  assertEquals(again.result.replacements, []);
  assertEquals(again.output, read("already-migrated.expected.ts"));
});

Deno.test("codemod - Deno.realPathSync becomes canonicalPathSync", () => {
  const { output } = run("realpath", ["fs"]);
  assertEquals(output, read("realpath.expected.ts"));
});

Deno.test("codemod - inserts after the header comment when there are no imports", () => {
  const { output } = run("no-imports", ["fs"]);
  assertEquals(output, read("no-imports.expected.ts"));
});

Deno.test("codemod - temp rule maps MakeTempOptions to TempOptions", () => {
  const { output } = run("temp-basic", ["temp"]);
  assertEquals(output, read("temp-basic.expected.ts"));
});

Deno.test("codemod - env rule rewrites the Deno.env expression", () => {
  const { result, output } = run("env-basic", ["env"]);
  assertEquals(output, read("env-basic.expected.ts"));
  assertEquals(result.replacements.length, 3);
});

Deno.test("codemod - env rule reports a local env binding", () => {
  const { result, output } = run("env-collision", ["env"]);
  assertEquals(output, read("env-collision.expected.ts"));
  assertEquals(result.collisions, [{ name: "env", line: 2, module: "env.ts" }]);
  assertEquals(result.replacements, []);
});

Deno.test("codemod - process rule turns args/pid into calls", () => {
  const { output } = run("process-basic", ["process"]);
  assertEquals(output, read("process-basic.expected.ts"));
});

Deno.test("codemod - platform rule rewrites Deno.build.os/arch", () => {
  const { output } = run("platform-basic", ["platform"]);
  assertEquals(output, read("platform-basic.expected.ts"));
});

Deno.test("codemod - a locally bound Deno receiver is left alone", () => {
  // Shadowing is per meaning: a value-only `Deno` parameter does not hide the
  // global namespace in `Deno.FileInfo`, and a local `type Deno` does not hide
  // the global value in `Deno.readTextFileSync(...)`.
  const { result, output } = run("shadowed-deno", ["fs"]);
  assertEquals(output, read("shadowed-deno.expected.ts"));
  assertEquals(result.replacements.length, 4);
  assertEquals(result.collisions, []);
});

Deno.test("codemod - a type-only namespace import is not overwritten", () => {
  const { result, output } = run("type-ns-import", ["fs"]);
  assertEquals(output, read("type-ns-import.expected.ts"));
  assertEquals(result.importsAdded, { "fs.ts": ["DirEntry"] });
});

Deno.test("codemod - a type-only import conflicts with a value rewrite", () => {
  const { result, output } = run("type-value-conflict", ["fs"]);
  // Both the inline `type statSync` and the declaration-level
  // `import type { lstatSync }` block the value rewrite; the file is unchanged.
  assertEquals(output, read("type-value-conflict.input.ts"));
  assertEquals(result.replacements, []);
  assertEquals(result.collisions, [
    { name: "statSync", line: 1, module: "fs.ts" },
    { name: "lstatSync", line: 2, module: "fs.ts" },
  ]);
});

Deno.test("codemod - a file assigning to Deno.* is skipped whole", () => {
  const { result, output } = run("assignment-skip", ["fs"]);
  assertEquals(result.skipped, "assigns to Deno.readTextFileSync at line 2");
  assertEquals(result.replacements, []);
  assertEquals(output, read("assignment-skip.input.ts"));
});

Deno.test("codemod - every form of write to Deno.* skips the file", () => {
  const cases: [string, RuleName[], string][] = [
    ["write-compound", ["fs"], "assigns to Deno.readTextFileSync at line 2"],
    ["write-nested", ["env", "platform"], "assigns to Deno.build.os at line 2"],
    ["write-delete", ["env"], "assigns to Deno.env at line 2"],
    ["write-destructure-object", ["fs"], "assigns to Deno.readTextFileSync at line 2"],
    ["write-destructure-array", ["platform"], "assigns to Deno.build.os at line 2"],
    ["write-for-of", ["platform"], "assigns to Deno.build.os at line 2"],
    ["write-asserted-target", ["fs"], "assigns to Deno.readTextFileSync at line 2"],
    ["write-non-null", ["platform"], "assigns to Deno.build.os at line 2"],
    // A patch through a wrapped receiver: rewriting `original` to the layer
    // wrapper would make the patched function call itself.
    [
      "write-asserted-receiver",
      ["fs"],
      "assigns to (Deno as any).readTextFileSync at line 2",
    ],
    ["write-asserted-nested", ["platform"], "assigns to (<any> Deno.build).os at line 2"],
    ["write-element-access", ["fs"], 'assigns to Deno["readTextFileSync"] at line 2'],
    // Deno used other than as `Deno.x`: what is done with it cannot be followed.
    ["write-define-property", ["fs"], "uses Deno other than as Deno.x at line 2"],
    ["write-define-property-paren", ["fs"], "uses Deno other than as Deno.x at line 2"],
    ["write-alias", ["fs"], "uses Deno other than as Deno.x at line 1"],
    ["write-shorthand", ["fs"], "uses Deno other than as Deno.x at line 1"],
    ["write-global-this", ["fs"], "reaches Deno through globalThis.Deno at line 2"],
    ["write-global-this-element", ["fs"], 'reaches Deno through self["Deno"] at line 2'],
    [
      "write-global-this-template",
      ["fs"],
      "reaches Deno through globalThis[`Deno`] at line 2",
    ],
    [
      "write-global-this-paren-key",
      ["fs"],
      'reaches Deno through globalThis[("Deno")] at line 2',
    ],
    ["write-object-assign", ["platform"], "assigns to Deno.build via Object.assign at line 2"],
    [
      "write-object-assign-paren",
      ["platform"],
      "assigns to Deno.build via (Object.assign) at line 2",
    ],
    [
      "write-object-assign-element",
      ["platform"],
      'assigns to Deno.build via Object["assign"] at line 2',
    ],
    [
      "write-object-assign-template",
      ["platform"],
      "assigns to Deno.build via Object[`assign`] at line 2",
    ],
    [
      "write-object-assign-paren-key",
      ["platform"],
      'assigns to Deno.build via Object[("assign")] at line 2',
    ],
  ];
  for (const [name, rules, skipped] of cases) {
    const { result, output } = run(name, rules);
    assertEquals(result.skipped, skipped, name);
    assertEquals(result.replacements, [], name);
    assertEquals(output, read(`${name}.input.ts`), name);
  }
});

Deno.test("codemod - Deno.* inside object and array literals that are not written is rewritten", () => {
  const { result, output } = run("literal-not-write", ["fs"]);
  assertEquals(result.skipped, undefined);
  assertEquals(output, read("literal-not-write.expected.ts"));
});

Deno.test("codemod - Deno.x as a later argument and typeof Deno are not writes", () => {
  const { result, output } = run("mutator-not-write", ["fs"]);
  assertEquals(result.skipped, undefined);
  assertEquals(output, read("mutator-not-write.expected.ts"));
});

Deno.test("codemod - a call on an owner named like an Object.prototype key is not a mutator", () => {
  const { result, output } = run("mutator-inherited-key", ["fs"]);
  assertEquals(result.skipped, undefined);
  assertEquals(output, read("mutator-inherited-key.expected.ts"));
});

Deno.test("codemod --reverse - round-trips the basic fixtures", () => {
  const cases: [string, RuleName[]][] = [
    ["fs-basic", ["fs"]],
    ["no-imports", ["fs"]],
    ["temp-basic", ["temp"]],
    ["env-basic", ["env"]],
    ["process-basic", ["process"]],
    ["platform-basic", ["platform"]],
  ];
  for (const [name, rules] of cases) {
    const { output } = run(name, rules, { reverse: true, input: `${name}.expected.ts` });
    assertEquals(output, read(`${name}.input.ts`), name);
  }
});

Deno.test("codemod --reverse - expands shorthand properties to explicit assignments", () => {
  const { result, output } = run("reverse-shorthand", ["platform"], { reverse: true });
  assertEquals(output, read("reverse-shorthand.expected.ts"));
  assertEquals(result.importsRemoved, { "platform.ts": ["arch", "os"] });
});

Deno.test("codemod --reverse - keeps an import whose Deno.* would be shadowed", () => {
  const { result, output } = run("reverse-shadowed-deno", ["fs", "platform"], { reverse: true });
  assertEquals(output, read("reverse-shadowed-deno.expected.ts"));
  assertEquals(result.left, [
    { name: "statSync", line: 4, module: "fs.ts" },
    { name: "os", line: 7, module: "platform.ts" },
  ]);
  assertEquals(result.importsRemoved, { "fs.ts": ["FileInfo"] });
});

Deno.test("codemod --reverse - keeps an import that the file re-exports", () => {
  const { result, output } = run("reverse-reexport", ["platform", "process"], { reverse: true });
  assertEquals(output, read("reverse-reexport.expected.ts"));
  assertEquals(result.left, [
    { name: "os", line: 3, module: "platform.ts" },
    { name: "cwd", line: 4, module: "process.ts" },
  ]);
  assertEquals(result.importsRemoved, { "platform.ts": ["arch"] });
});

Deno.test("codemod --reverse - follows aliases and reports what it cannot express", () => {
  const alias = run("existing-alias", ["platform"], {
    reverse: true,
    input: "existing-alias.expected.ts",
  });
  assertEquals(alias.output, read("reverse-alias.expected.ts"));
  const left = run("reverse-left", ["process"], { reverse: true });
  assertEquals(left.output, read("reverse-left.expected.ts"));
  assertEquals(left.result.left, [{ name: "args", line: 3, module: "process.ts" }]);
  assertEquals(left.result.importsRemoved, { "process.ts": ["exit"] });
});

Deno.test("codemod --reverse - reports canonicalPathSync instead of reversing it", () => {
  const { result, output } = run("reverse-realpath", ["fs"], { reverse: true });
  assertEquals(output, read("reverse-realpath.expected.ts"));
  assertEquals(result.left, [
    { name: "canonicalPathSync", line: 2, module: "fs.ts", hint: kCanonicalReverseHint },
  ]);
  assertEquals(result.importsRemoved, { "fs.ts": ["statSync"] });
  assertEquals(result.replacements.length, 1);

  // A re-export keeps the import and still carries the hint.
  const reexport = run("reverse-realpath-reexport", ["fs"], { reverse: true });
  assertEquals(reexport.output, read("reverse-realpath-reexport.input.ts"));
  assertEquals(reexport.result.left, [
    { name: "canonicalPathSync", line: 2, module: "fs.ts", hint: kCanonicalReverseHint },
  ]);
  assertEquals(reexport.result.replacements, []);
});

Deno.test("codemod - collectFiles applies the skip list", () => {
  const tmp = Deno.makeTempDirSync({ prefix: "codemod-walk-" });
  try {
    for (
      const rel of [
        "src/core/a.ts",
        "src/core/b.d.ts",
        "src/core/t.ejs.ts",
        "src/core/node_modules/x/index.ts",
        "src/core/lib/l.ts",
        "src/deno_ral/fs.ts",
        "src/vendor/v.ts",
        "src/resources/extension-subtrees/julia-engine/src/j.ts",
        "src/resources/scripts/s.ts",
        "src/resources/create/c.ts",
        "src/resources/tools/ast-diagram/main.ts",
        "src/webui/quarto-preview/build.ts",
        "src/webui/quarto-preview/src/x.ts",
        "src/command/c.ts",
      ]
    ) {
      const p = join(tmp, ...rel.split("/"));
      Deno.mkdirSync(dirname(p), { recursive: true });
      Deno.writeTextFileSync(p, "");
    }
    const files = collectFiles(join(tmp, "src"), tmp)
      .map((f) => relative(tmp, f).replaceAll("\\", "/"));
    assertEquals(files, [
      "src/command/c.ts",
      "src/core/a.ts",
      "src/webui/quarto-preview/src/x.ts",
    ]);
    assert(!files.some((f) => f.startsWith("src/core/lib/")));
  } finally {
    Deno.removeSync(tmp, { recursive: true });
  }
});
