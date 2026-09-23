/*
 * smoke-all-prerender-isolation.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { assert, assertEquals } from "testing/asserts";
import { unitTest } from "../test.ts";
import { dirname, fromFileUrl, join } from "../../src/deno_ral/path.ts";
import { safeExistsSync } from "../../src/core/path.ts";

// tests/unit/ -> tests/ -> repo root
function resolveQuartoRoot(): string {
  const envRoot = Deno.env.get("QUARTO_ROOT");
  if (envRoot && safeExistsSync(join(envRoot, "src", "import_map.json"))) {
    return envRoot;
  }
  const here = dirname(fromFileUrl(import.meta.url));
  const derived = dirname(dirname(here));
  if (safeExistsSync(join(derived, "src", "import_map.json"))) {
    return derived;
  }
  throw new Error(
    "Could not resolve the Quarto repo root: QUARTO_ROOT is unset or invalid, " +
      `and the derived root ${derived} has no src/import_map.json.`,
  );
}

interface JUnitTestcase {
  name: string;
  failed: boolean;
}

function parseJUnit(
  xml: string,
): { total: number; failures: number; cases: JUnitTestcase[] } {
  const suiteMatch = xml.match(
    /<testsuites[^>]*\btests="(\d+)"[^>]*\bfailures="(\d+)"/,
  );
  const cases: JUnitTestcase[] = [];
  for (
    const m of xml.matchAll(/<testcase\b([^>]*)>([\s\S]*?)<\/testcase>/g)
  ) {
    const nameMatch = m[1].match(/name="([^"]*)"/);
    cases.push({
      name: nameMatch ? nameMatch[1] : "",
      failed: /<failure\b/.test(m[2]),
    });
  }
  return {
    total: suiteMatch ? parseInt(suiteMatch[1], 10) : cases.length,
    failures: suiteMatch
      ? parseInt(suiteMatch[2], 10)
      : cases.filter((c) => c.failed).length,
    cases,
  };
}

unitTest(
  "smoke-all isolates a failing project pre-render instead of aborting the whole file",
  async () => {
    const quartoRoot = resolveQuartoRoot();
    const testsDir = join(quartoRoot, "tests");

    const tmpRoot = Deno.makeTempDirSync({
      prefix: "quarto-smoke-all-prerender-",
    });
    try {
      const smokeAllDir = join(tmpRoot, "smoke-all");
      const projectDir = join(smokeAllDir, "_prerender-crash");
      Deno.mkdirSync(projectDir, { recursive: true });

      Deno.writeTextFileSync(
        join(projectDir, "_quarto.yml"),
        "project:\n  type: default\n  render:\n" +
          "    - broken-b.qmd\n    - broken-c.qmd\n",
      );

      // This file does not request a project pre-render. It sorts before files
      // that do, but project.render excludes it. Its HTML test spec registers
      // cleanup paths for a skipped file.
      Deno.writeTextFileSync(
        join(projectDir, "broken-a.qmd"),
        [
          "---",
          "title: a",
          "_quarto:",
          "  tests:",
          "    html:",
          "      ensureHtmlElements:",
          '        - ["body"]',
          "---",
          "",
          "# a",
          "",
        ].join("\n"),
      );
      // Pre-create outputs for broken-a.qmd. Because project.render excludes
      // the file, their removal verifies cleanup for a skipped file.
      Deno.writeTextFileSync(
        join(projectDir, "broken-a.html"),
        "<html><body>sentinel</body></html>\n",
      );
      const supportDir = join(projectDir, "broken-a_files");
      Deno.mkdirSync(supportDir, { recursive: true });
      Deno.writeTextFileSync(
        join(supportDir, "sentinel.txt"),
        "sentinel\n",
      );

      // This file requests the project pre-render and makes it fail.
      Deno.writeTextFileSync(
        join(projectDir, "broken-b.qmd"),
        [
          "---",
          "title: b",
          "_quarto:",
          "  render-project: true",
          "filters:",
          "  - does-not-exist.lua",
          "---",
          "",
          "# b",
          "",
        ].join("\n"),
      );
      // A second file requests the same project pre-render, verifying that it
      // runs once per project.
      Deno.writeTextFileSync(
        join(projectDir, "broken-c.qmd"),
        [
          "---",
          "title: c",
          "_quarto:",
          "  render-project: true",
          "---",
          "",
          "# c",
          "",
        ].join("\n"),
      );

      // This healthy control file sorts after the broken project and must
      // still run.
      Deno.writeTextFileSync(
        join(smokeAllDir, "healthy-canary.qmd"),
        ["---", "title: healthy", "---", "", "# healthy", ""].join("\n"),
      );

      assert(
        safeExistsSync(join(projectDir, "broken-a.html")),
        "sentinel broken-a.html must exist before the child run",
      );
      assert(
        safeExistsSync(join(supportDir, "sentinel.txt")),
        "sentinel broken-a_files/sentinel.txt must exist before the child run",
      );

      const junitPath = join(tmpRoot, "report.xml");
      const importMapArg = `--importmap=${
        join(quartoRoot, "src", "import_map.json")
      }`;

      const command = new Deno.Command(Deno.execPath(), {
        args: [
          "test",
          "--config",
          join(testsDir, "test-conf.json"),
          "--v8-flags=--enable-experimental-regexp-engine",
          "--unstable-kv",
          "--unstable-ffi",
          "--no-lock",
          "--allow-all",
          importMapArg,
          `--junit-path=${junitPath}`,
          "smoke/smoke-all.test.ts",
          "--",
          join(projectDir, "broken-a.qmd"),
          join(projectDir, "broken-b.qmd"),
          join(projectDir, "broken-c.qmd"),
          join(smokeAllDir, "healthy-canary.qmd"),
        ],
        cwd: testsDir,
        stdout: "piped",
        stderr: "piped",
      });

      const output = await command.output();
      const stdout = new TextDecoder().decode(output.stdout);
      const stderr = new TextDecoder().decode(output.stderr);
      const combined = stdout + stderr;

      const junitXml = Deno.readTextFileSync(junitPath);
      const { total, failures, cases } = parseJUnit(junitXml);

      const healthyCase = cases.find((c) => c.name.includes("healthy-canary"));
      assert(
        healthyCase !== undefined,
        `expected a testcase for healthy-canary.qmd; got: ${
          JSON.stringify(cases)
        }\n---\n${combined}`,
      );
      assertEquals(healthyCase!.failed, false);

      // Exactly one synthetic failure is reported for the broken project,
      // even though two files request its pre-render.
      const projectFailures = cases.filter((c) =>
        /_prerender-crash/.test(c.name) && c.failed
      );
      assertEquals(
        projectFailures.length,
        1,
        `expected exactly one synthetic failure for the broken project; got: ${
          JSON.stringify(cases)
        }`,
      );

      // No test is registered for any file in the broken project, including
      // the file encountered before any file requests a project pre-render.
      for (const fileName of ["broken-a.qmd", "broken-b.qmd", "broken-c.qmd"]) {
        const registered = cases.some((c) => c.name.includes(fileName));
        assert(
          !registered,
          `${fileName} must not be registered as its own test; got: ${
            JSON.stringify(cases)
          }`,
        );
      }

      // Expect only the healthy control and one synthetic project failure.
      assertEquals(
        total,
        2,
        `expected exactly 2 total testcases; got: ${JSON.stringify(cases)}`,
      );
      assertEquals(failures, 1);

      // No module-evaluation abort: the failure is isolated to a synthetic
      // test, not a crash of the whole smoke-all.test.ts file.
      assert(
        !combined.includes("Uncaught error from"),
        `expected no module-evaluation abort; got:\n${combined}`,
      );

      assertEquals(
        output.code,
        1,
        "the run still reports failure overall (one synthetic test failed)",
      );

      // Cleanup: the entry synthesized for the skipped broken-a.qmd must
      // still remove its sentinel outputs, and the in-place project root
      // itself must survive.
      assert(
        !safeExistsSync(join(projectDir, "broken-a.html")),
        "broken-a.html should have been removed by the synthesized cleanup entry",
      );
      assert(
        !safeExistsSync(supportDir),
        "broken-a_files/ should have been removed by the synthesized cleanup entry",
      );
      assert(
        safeExistsSync(projectDir),
        "the in-place project root itself must survive cleanup",
      );
    } finally {
      Deno.removeSync(tmpRoot, { recursive: true });
    }
  },
);
