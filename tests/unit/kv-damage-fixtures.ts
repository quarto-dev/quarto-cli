/*
 * kv-damage-fixtures.ts
 *
 * Helpers that damage a closed Deno KV store the way real caches get damaged.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { DatabaseSync } from "node:sqlite";
import { assert, assertEquals } from "../asserts.ts";

// SET clauses for damageKvRow
export const kZeroValue = "v = zeroblob(length(v))";
export const kUnknownEncoding = "v_encoding = 99";
export const kTextValue = "v = 'text'";

const kTruncateSize = 16384;

// Deno KV tuple encoding of an all-string key
export function kvKeyHex(key: string[]): string {
  return key.map((part) => {
    const hex = Array.from(new TextEncoder().encode(part))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
    return `02${hex}00`;
  }).join("");
}

export function damageKvRow(file: string, key: string[], set: string): void {
  const db = new DatabaseSync(file);
  try {
    const result = db
      .prepare(`UPDATE kv SET ${set} WHERE hex(k) = ?`)
      .run(kvKeyHex(key));
    assertEquals(
      Number(result.changes),
      1,
      `No kv row for key ${JSON.stringify(key)}`,
    );
  } finally {
    db.close();
  }
}

export function truncateKvFile(file: string): void {
  assert(
    Deno.statSync(file).size > kTruncateSize,
    `${file} is too small to truncate`,
  );
  Deno.truncateSync(file, kTruncateSize);
}

export function writeNonDatabase(file: string): void {
  Deno.writeTextFileSync(file, "not a database");
}

// Zero the b-tree page header of the root page of the kv table. The store
// still opens; get, list and set then fail with "database disk image is
// malformed".
export function damageKvTableRoot(file: string): void {
  let rootpage: number;
  let pageSize: number;
  const db = new DatabaseSync(file);
  try {
    const root = db
      .prepare("SELECT rootpage FROM sqlite_master WHERE name = 'kv'")
      .get() as { rootpage: number };
    const size = db.prepare("PRAGMA page_size").get() as { page_size: number };
    rootpage = Number(root.rootpage);
    pageSize = Number(size.page_size);
  } finally {
    db.close();
  }
  const f = Deno.openSync(file, { write: true });
  try {
    f.seekSync((rootpage - 1) * pageSize, Deno.SeekMode.Start);
    f.writeSync(new Uint8Array(8));
  } finally {
    f.close();
  }
}

const kLockHolder = `import { DatabaseSync } from "node:sqlite";
const db = new DatabaseSync(Deno.args[0]);
db.exec("PRAGMA locking_mode=EXCLUSIVE; BEGIN EXCLUSIVE; COMMIT;");
console.log("ready");
for await (const _ of Deno.stdin.readable) {}
db.close();`;

// Holds an exclusive lock on the store from a child process until released.
export async function holdKvLock(
  file: string,
): Promise<{ release: () => Promise<void> }> {
  const child = new Deno.Command(Deno.execPath(), {
    args: ["eval", kLockHolder, file],
    stdin: "piped",
    stdout: "piped",
    stderr: "inherit",
  }).spawn();
  const reader = child.stdout.pipeThrough(new TextDecoderStream()).getReader();
  let out = "";
  while (!out.includes("ready")) {
    const { value, done } = await reader.read();
    if (done) {
      throw new Error(`Lock holder exited before ready: ${out}`);
    }
    out += value;
  }
  return {
    release: async () => {
      await child.stdin.close();
      await reader.cancel();
      await child.status;
    },
  };
}
