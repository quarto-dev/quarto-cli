/*
 * kv-damage.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "../asserts.ts";
import { test, unitTest } from "../test.ts";
import { noErrors, printsMessage } from "../verify.ts";
import { withTempDir } from "../utils.ts";
import { dirname, join } from "../../src/deno_ral/path.ts";
import { getKv, KvDamagedError, kvOp, openKv } from "../../src/deno_ral/kv.ts";
import {
  damageKvRow,
  damageKvTableRoot,
  kTextValue,
  kUnknownEncoding,
  kZeroValue,
  truncateKvFile,
  writeNonDatabase,
} from "./kv-damage-fixtures.ts";

const kWarnRegex = /Ignoring a damaged entry in the Quarto cache .*s\.kv/;

async function buildStore(
  file: string,
  entries: Record<string, number>,
) {
  const kv = await Deno.openKv(file);
  try {
    for (const [k, v] of Object.entries(entries)) {
      await kv.set([k], v);
    }
  } finally {
    kv.close();
  }
}

async function assertDamaged(
  file: string,
  open: () => Promise<unknown>,
  text: string,
) {
  const before = Deno.readFileSync(file);
  const e = await assertRejects(open, KvDamagedError);
  assertStringIncludes(e.message, file);
  assertStringIncludes(e.message, dirname(file));
  assertStringIncludes(e.message, text);
  assert(!e.message.includes("\n"));
  assertEquals(e.printName, false);
  assertEquals(e.printStack, false);
  assertEquals(e.file, file);
  assertEquals(Deno.readFileSync(file), before);
}

test({
  name: "kv - getKv reads a zeroed value as missing and warns once per file",
  type: "unit",
  context: {},
  execute: async () => {
    await withTempDir(async (dir) => {
      const file = join(dir, "s.kv");
      await buildStore(file, { a: 1, b: 2 });
      damageKvRow(file, ["a"], kZeroValue);
      damageKvRow(file, ["b"], kZeroValue);
      const kv = await openKv(file);
      try {
        assertEquals(await getKv(kv, file, ["a"]), null);
        assertEquals(await getKv(kv, file, ["b"]), null);
      } finally {
        kv.close();
      }
    });
  },
  verify: [
    noErrors,
    printsMessage({ level: "WARN", regex: kWarnRegex, count: 1 }),
  ],
});

test({
  name:
    "kv - getKv reads an unknown value encoding or a text value as missing, and a set repairs it",
  type: "unit",
  context: {},
  execute: async () => {
    await withTempDir(async (dir) => {
      const file = join(dir, "s.kv");
      await buildStore(file, { a: 1, b: 2 });
      damageKvRow(file, ["a"], kUnknownEncoding);
      damageKvRow(file, ["b"], kTextValue);
      const kv = await openKv(file);
      try {
        assertEquals(await getKv(kv, file, ["a"]), null);
        assertEquals(await getKv(kv, file, ["b"]), null);
        await kv.set(["a"], 3);
        await kv.set(["b"], 4);
        assertEquals(await getKv(kv, file, ["a"]), 3);
        assertEquals(await getKv(kv, file, ["b"]), 4);
      } finally {
        kv.close();
      }
    });
  },
  verify: [
    noErrors,
    printsMessage({ level: "WARN", regex: kWarnRegex, count: 1 }),
  ],
});

unitTest(
  "kv - openKv rejects a truncated store with KvDamagedError naming the folder",
  async () => {
    await withTempDir(async (dir) => {
      const file = join(dir, "s.kv");
      await buildStore(file, { a: 1, b: 2 });
      truncateKvFile(file);
      await assertDamaged(
        file,
        () => openKv(file),
        "database disk image is malformed",
      );
    });
  },
);

unitTest(
  "kv - openKv rejects a non-database file with KvDamagedError",
  async () => {
    await withTempDir(async (dir) => {
      const file = join(dir, "s.kv");
      writeNonDatabase(file);
      await assertDamaged(file, () => openKv(file), "file is not a database");
    });
  },
);

unitTest(
  "kv - a malformed page after open is file damage for getKv and for a whole list loop",
  async () => {
    await withTempDir(async (dir) => {
      const file = join(dir, "s.kv");
      await buildStore(file, {
        version: 1,
        a: 1,
        b: 2,
        c: 3,
        d: 4,
      });
      damageKvTableRoot(file);
      const kv = await openKv(file);
      try {
        await assertRejects(
          () => getKv(kv, file, ["version"]),
          KvDamagedError,
        );
        await assertRejects(
          () =>
            kvOp(file, async () => {
              for await (const _ of kv.list({ prefix: [] })) {
                // drain
              }
            }),
          KvDamagedError,
        );
      } finally {
        kv.close();
      }
    });
  },
);

unitTest("kv - a closed handle is not damage", async () => {
  await withTempDir(async (dir) => {
    const file = join(dir, "s.kv");
    const kv = await openKv(file);
    kv.close();
    const e = await assertRejects(() => getKv(kv, file, ["a"]), Error);
    assert(!(e instanceof KvDamagedError));
    assert(e.message.endsWith(`(Quarto cache: ${file})`), e.message);
    assert(e.cause !== undefined);
  });
});

unitTest("kv - an unopenable path is not damage", async () => {
  await withTempDir(async (dir) => {
    const file = join(dir, "missing", "s.kv");
    const e = await assertRejects(() => openKv(file), Error);
    assert(!(e instanceof KvDamagedError));
    assertStringIncludes(e.message, "unable to open database file");
    assertStringIncludes(e.message, `(Quarto cache: ${file})`);
  });
});
