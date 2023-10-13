import { join } from "path/mod.ts";
import { shortUuid } from "../../../src/core/uuid.ts";
import { fixupCoverageNames } from "./fixup_coverage.ts";
import { resourcePath } from "../../../src/core/resources.ts";

import type { CoverageEntry } from "./fixup_coverage.ts";

export function getDb() {
  const testsPath = resourcePath("../../tests");
  return Deno.openKv(join(testsPath, "lua_testcov_tool", "data", "main.db"));
}

type IncomingCov = {
  luacovFilename: string;
  testName: string;
};

export async function requestIncomingCovFilename(testName: string) {
  const db = await getDb();

  const uuid = shortUuid();
  const testsPath = resourcePath("../../tests");

  const incomingCovFilename = join(
    testsPath,
    "lua_testcov_tool",
    "data",
    "inbound",
    `incoming-${uuid}.stats.out`,
  );

  db.set(["incoming", uuid], {
    luacovFilename: incomingCovFilename,
    testName,
  });

  return incomingCovFilename;
}

export async function processIncomingQueue() {
  const db = await getDb();
  const quartoPath = resourcePath("../..");

  const entries = db.list({ prefix: ["incoming"] });
  for await (const entry of entries) {
    const { luacovFilename, testName } = entry.value as IncomingCov;
    try {
      const text = await Deno.readTextFile(luacovFilename);
      const coverage = fixupCoverageNames(text);
      const normalizedCoverage: Record<string, CoverageEntry> = {};
      for (const [key, value] of Object.entries(coverage)) {
        if (!value.name.startsWith(quartoPath)) {
          console.log(
            `coverage name ${value.name} not in main path, won't normalize`,
          );
        }
        normalizedCoverage[key.replace(quartoPath, "")] = value;
      }

      // break up the coverage object into tiny objects that fit
      // the 64k limit of the kv store
      for (const [key, value] of Object.entries(normalizedCoverage)) {
        await db.set(["coverage", testName, key], {
          coverage: value,
        });
      }

      await db.delete(entry.key);
      await Deno.remove(luacovFilename);
    } catch (e) {
      console.log(e);
      // do nothing
    }
  }
}

export async function getTestsCovering(
  file: string,
  lineNumber?: number,
) {
  const tests: string[] = [];
  const db = await getDb();

  // this is pretty inefficient,
  // shrug for now
  const entries = db.list({ prefix: ["coverage"] });
  for await (const entry of entries) {
    const key = entry.key;
    const value = entry.value as { coverage: CoverageEntry };
    if (key[key.length - 1] !== file) {
      continue;
    }
    if (lineNumber === undefined || value.coverage.entries[lineNumber - 1]) {
      tests.push(key[1] as string);
    }
  }
  return tests;
}
