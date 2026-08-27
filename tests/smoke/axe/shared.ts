/*
 * shared.ts
 *
 * Plumbing shared by the axe smoke tests. Each test drives one fixture site
 * under tests/docs/axe-scan/sites/ — the sites are split by concern so that
 * adding a page to one cannot move an assertion in another.
 *
 * What differs between the tests is the verifiers. Rendering, scanning,
 * reading the artifacts and cleaning up are identical, and live here.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { assert, assertEquals } from "testing/asserts";
import { existsSync } from "../../../src/deno_ral/fs.ts";
import { ExecuteOutput, testQuartoCmd, Verify } from "../../test.ts";
import { fileExists, validJsonWithFields } from "../../verify.ts";
import { docs } from "../../utils.ts";
import { quarto } from "../../../src/quarto.ts";
import { AxeCell } from "../../../src/command/call/axe/scan.ts";
import {
  AxeFinding,
  axeFindingsSchema,
  kFindingsVersion,
  kSignatureScheme,
} from "../../../src/command/call/axe/schemas.ts";

export const kFindingsFile = "_axe-checks/findings.json";
export const kReportFile = "_axe-checks/report.md";
export const kReadmeFile = "_axe-checks/README.md";
export const kCellsDir = "_axe-checks/cells";

/** `findings.json`, parsed and checked against its own published schema. */
export function readFindings() {
  const parsed = axeFindingsSchema.safeParse(
    JSON.parse(Deno.readTextFileSync(kFindingsFile)),
  );
  assert(
    parsed.success,
    "findings.json does not satisfy its own schema: " +
      (parsed.success ? "" : JSON.stringify(parsed.error.issues, null, 2)),
  );
  return parsed.data;
}

/**
 * One raw per-cell payload, by its artifact name — `index__1440x900__dark`,
 * `static_legacy__390x844__light`.
 */
export function readCell(name: string): AxeCell {
  return JSON.parse(
    Deno.readTextFileSync(`${kCellsDir}/${name}.json`),
  ) as AxeCell;
}

/**
 * Look a finding up by signature. Never by index or count: the fixture sites
 * also produce findings from Quarto's own chrome, which belong to Quarto and
 * may change on upgrade.
 */
export function find(findings: AxeFinding[], signature: string): AxeFinding {
  const finding = findings.find((f) => f.signature === signature);
  assert(
    finding,
    `no finding with signature '${signature}'. Present:\n  ` +
      findings.map((f) => f.signature).join("\n  "),
  );
  return finding!;
}

/**
 * Every cell produced an axe payload.
 *
 * This is the real gate, and deliberately the only cell assertion: the scanner
 * fails closed, so a timeout, an error or a missing payload must never read as
 * a pass. The cell *total* is not asserted anywhere — that would be golden-file
 * coupling, and it broke twice when a page was added.
 */
export const allCellsOk: Verify = {
  name: "every cell completed",
  verify: (_output: ExecuteOutput[]) => {
    const results = readFindings();
    assertEquals(
      results.cells.notOk,
      0,
      `not-ok cells: ${JSON.stringify(results.notOkCells)}`,
    );
    assertEquals(results.cells.total, results.cells.ok);
    assert(results.cells.total > 0, "nothing was scanned");
    return Promise.resolve();
  },
};

/** The per-page modes `findings.json` records, keyed by output path. */
export function pageModes(): Record<string, string[]> {
  return Object.fromEntries(
    readFindings().pages.map((page) => [page.output, page.modes]),
  );
}

/** Every cell artifact's filename, e.g. `index__1440x900__default`. */
export function cellNames(): string[] {
  return [...Deno.readDirSync(kCellsDir)]
    .filter((entry) => entry.name.endsWith(".json"))
    .map((entry) => entry.name.replace(/\.json$/, ""))
    .sort();
}

/**
 * The matrix summary printed before the browser launched matches what was
 * scanned. The matrix is discovered from the rendered HTML, so a drift between
 * the announcement and the artifacts means discovery and scanning disagree.
 */
export const summaryMatchesMatrix: Verify = {
  name: "the printed matrix matches the scanned cells",
  verify: (output: ExecuteOutput[]) => {
    const summary = output.map((line) => line.msg).join("\n").match(
      /axe: (\d+) pages \([^)]*\) × \d+ viewports — (\d+) cells/,
    );
    assert(summary, "the matrix summary line was not printed");
    const results = readFindings();
    assertEquals(results.pages.length, parseInt(summary![1], 10));
    assertEquals(results.cells.total, parseInt(summary![2], 10));
    return Promise.resolve();
  },
};

/**
 * Render one fixture site, scan it, and run `verifiers` against the artifacts.
 *
 * The fixtures are source only: a committed render would carry `site_libs/` and
 * go stale on every Quarto change, so each test renders in setup and removes
 * both the render and the scan artifacts afterwards.
 */
export function axeSmokeTest(
  site: string,
  name: string,
  verifiers: Verify[],
) {
  const siteDir = docs(`axe-scan/sites/${site}`);
  testQuartoCmd(
    "call",
    ["axe", "_site"],
    [
      fileExists(kFindingsFile),
      fileExists(kReportFile),
      fileExists(kReadmeFile),
      // the artifact dir self-ignores, so it can't be committed by accident
      fileExists("_axe-checks/.gitignore"),
      validJsonWithFields(kFindingsFile, {
        version: kFindingsVersion,
        signatureScheme: kSignatureScheme,
      }),
      allCellsOk,
      summaryMatchesMatrix,
      ...verifiers,
    ],
    {
      cwd: () => siteDir,
      setup: async () => {
        await quarto(["render"]);
      },
      teardown: () => {
        for (const dir of ["_site", "_axe-checks"]) {
          if (existsSync(dir)) {
            Deno.removeSync(dir, { recursive: true });
          }
        }
        return Promise.resolve();
      },
      // a website render plus a browser cell per page x viewport x theme
      timeout: 900000,
    },
    name,
  );
}
