/*
 * fs.test.ts
 *
 * Compatibility contract for the plain filesystem calls in
 * src/deno_ral/fs.ts. PR 27 must keep this file green on node:fs.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import {
  assert,
  assertEquals,
  assertStringIncludes,
  assertThrows,
} from "../../asserts.ts";
import { isWindows } from "../../../src/deno_ral/platform.ts";
import { isNotFound } from "../../../src/deno_ral/errors.ts";
import { makeTempDirSync } from "../../../src/deno_ral/temp.ts";
import { join } from "../../../src/deno_ral/path.ts";
import {
  canonicalPathSync,
  chmodSync,
  copyFileSync,
  create,
  existsSync,
  getFileInfoType,
  lstatSync,
  mkdirSync,
  open,
  readDir,
  readDirSync,
  readFileSync,
  readLinkSync,
  readTextFile,
  readTextFileSync,
  removeSync,
  renameSync,
  statSync,
  symlinkSync,
  truncateSync,
  utimeSync,
  writeFileSync,
  writeTextFileSync,
} from "../../../src/deno_ral/fs.ts";

function withDir(fn: (dir: string) => void | Promise<void>) {
  return async () => {
    const dir = makeTempDirSync({ prefix: "ral-fs-" });
    try {
      await fn(dir);
    } finally {
      removeSync(dir, { recursive: true });
    }
  };
}

unitTest("fs - text round trip and append", withDir((dir) => {
  const file = join(dir, "a.txt");
  writeTextFileSync(file, "hello");
  writeTextFileSync(file, " world", { append: true });
  assertEquals(readTextFileSync(file), "hello world");
}));

unitTest("fs - read errors carry the path once and satisfy isNotFound", withDir(async (dir) => {
  const missing = join(dir, "missing.txt");
  const e = assertThrows(() => readTextFileSync(missing));
  assert(isNotFound(e));
  assertStringIncludes((e as Error).message, "Path: " + missing);
  assertEquals((e as Error).message.split("Path: ").length, 2, "path appended once");
  let asyncErr: unknown;
  try {
    await readTextFile(missing);
  } catch (err) {
    asyncErr = err;
  }
  assert(isNotFound(asyncErr));
  assertStringIncludes((asyncErr as Error).message, "Path: " + missing);
}));

unitTest("fs - bytes round trip", withDir((dir) => {
  const file = join(dir, "b.bin");
  writeFileSync(file, new Uint8Array([1, 2, 3]));
  assertEquals([...readFileSync(file)], [1, 2, 3]);
}));

unitTest("fs - statSync and lstatSync", withDir((dir) => {
  const file = join(dir, "s.txt");
  writeTextFileSync(file, "12345");
  const info = statSync(file);
  assertEquals(info.isFile, true);
  assertEquals(info.isDirectory, false);
  assertEquals(info.size, 5);
  assert(info.mtime instanceof Date);
  assertEquals(statSync(dir).isDirectory, true);
  if (!isWindows) {
    const link = join(dir, "s-link");
    symlinkSync(file, link);
    assertEquals(lstatSync(link).isSymlink, true);
    assertEquals(statSync(link).isSymlink, false);
    assertEquals(readLinkSync(link), file);
  }
}));

unitTest("fs - mkdirSync recursive and removeSync recursive", withDir((dir) => {
  const nested = join(dir, "x", "y", "z");
  mkdirSync(nested, { recursive: true });
  assert(existsSync(nested));
  removeSync(join(dir, "x"), { recursive: true });
  assert(!existsSync(join(dir, "x")));
}));

unitTest("fs - renameSync and copyFileSync", withDir((dir) => {
  const a = join(dir, "a.txt");
  const b = join(dir, "b.txt");
  const c = join(dir, "c.txt");
  writeTextFileSync(a, "A");
  renameSync(a, b);
  assert(!existsSync(a));
  copyFileSync(b, c);
  assertEquals(readTextFileSync(c), "A");
  assertEquals(readTextFileSync(b), "A");
}));

unitTest("fs - readDirSync and readDir are sorted by name", withDir(async (dir) => {
  for (const name of ["c.txt", "a.txt", "b.txt"]) {
    writeTextFileSync(join(dir, name), name);
  }
  mkdirSync(join(dir, "B-dir"));
  const sync = readDirSync(dir).map((e) => e.name);
  assertEquals(sync, ["B-dir", "a.txt", "b.txt", "c.txt"]);
  const entry = readDirSync(dir).find((e) => e.name === "B-dir")!;
  assertEquals(entry.isDirectory, true);
  assertEquals(entry.isFile, false);
  const async: string[] = [];
  for await (const e of readDir(dir)) {
    async.push(e.name);
  }
  assertEquals(async, sync);
}));

unitTest("fs - canonicalPathSync resolves symlinks and throws when missing", withDir((dir) => {
  const real = join(dir, "real");
  mkdirSync(real);
  const canonicalReal = canonicalPathSync(real);
  assertEquals(canonicalPathSync(join(real, "..", "real")), canonicalReal);
  assert(!canonicalReal.startsWith("\\\\?\\"), "no Windows verbatim prefix");
  if (!isWindows) {
    const link = join(dir, "link");
    symlinkSync(real, link);
    assertEquals(canonicalPathSync(link), canonicalReal, "symlinks are resolved");
  }
  const e = assertThrows(() => canonicalPathSync(join(dir, "missing")));
  assert(isNotFound(e));
}));

unitTest("fs - getFileInfoType takes the layer's FileInfo", withDir((dir) => {
  const file = join(dir, "f.txt");
  writeTextFileSync(file, "x");
  assertEquals(getFileInfoType(lstatSync(file)), "file");
  assertEquals(getFileInfoType(lstatSync(dir)), "dir");
  if (!isWindows) {
    const link = join(dir, "f-link");
    symlinkSync(file, link);
    assertEquals(getFileInfoType(lstatSync(link)), "symlink");
  }
}));

unitTest("fs - utimeSync and truncateSync", withDir((dir) => {
  const file = join(dir, "u.txt");
  writeTextFileSync(file, "0123456789");
  const when = new Date("2020-01-02T03:04:05Z");
  utimeSync(file, when, when);
  assertEquals(statSync(file).mtime?.getTime(), when.getTime());
  truncateSync(file, 4);
  assertEquals(readTextFileSync(file), "0123");
  truncateSync(file);
  assertEquals(readTextFileSync(file), "");
}));

unitTest("fs - chmodSync (POSIX)", withDir((dir) => {
  if (isWindows) return;
  const file = join(dir, "m.txt");
  writeTextFileSync(file, "x");
  chmodSync(file, 0o600);
  assertEquals((statSync(file).mode ?? 0) & 0o777, 0o600);
}));

unitTest("fs - open/create expose streams and close", withDir(async (dir) => {
  const file = join(dir, "o.txt");
  const out = await create(file);
  const writer = out.writable.getWriter();
  await writer.write(new TextEncoder().encode("line1\nline2\n"));
  await writer.close();
  const inp = await open(file, { read: true });
  const text = await new Response(inp.readable).text();
  assertEquals(text, "line1\nline2\n");
  const appender = await open(file, { append: true });
  appender.writeSync(new TextEncoder().encode("line3\n"));
  appender.close();
  assertEquals(readTextFileSync(file), "line1\nline2\nline3\n");
}));
