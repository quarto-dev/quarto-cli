/*
 * kv.ts
 *
 * Deno KV access that tells a damaged cache apart from other failures.
 *
 * Deno gives these errors no code, so classification is by message.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { ErrorEx } from "../core/lib/error.ts";
import { warning } from "./log.ts";
import { dirname } from "./path.ts";

export class KvDamagedError extends ErrorEx {
  readonly file: string;
  constructor(file: string, cause: unknown) {
    super(
      "KvDamagedError",
      `The Quarto cache ${file} is damaged (${messageOf(cause)}). ` +
        `Delete the folder ${dirname(file)} and run Quarto again.`,
      false,
      false,
    );
    this.file = file;
    this.cause = cause;
  }
}

const messageOf = (e: unknown) => e instanceof Error ? e.message : String(e);

const isFileDamage = (message: string) =>
  message.includes("database disk image is malformed") ||
  message.includes("file is not a database");

const isValueDamage = (e: unknown) => {
  if (e instanceof RangeError) {
    return e.message.includes("could not deserialize value");
  }
  if (e instanceof TypeError) {
    return (e.message.includes("value encoding") &&
      e.message.includes("is unknown")) ||
      e.message.startsWith("Invalid column type");
  }
  return false;
};

const wrap = (file: string, e: unknown) =>
  new Error(`${messageOf(e)} (Quarto cache: ${file})`, { cause: e });

const warnedFiles = new Set<string>();

export async function kvOp<T>(file: string, op: () => Promise<T>): Promise<T> {
  try {
    return await op();
  } catch (e) {
    if (isFileDamage(messageOf(e))) {
      throw new KvDamagedError(file, e);
    }
    throw wrap(file, e);
  }
}

export function openKv(file: string): Promise<Deno.Kv> {
  return kvOp(file, () => Deno.openKv(file));
}

export async function getKv<T>(
  kv: Deno.Kv,
  file: string,
  key: Deno.KvKey,
): Promise<T | null> {
  try {
    return (await kv.get<T>(key)).value;
  } catch (e) {
    const message = messageOf(e);
    if (isFileDamage(message)) {
      throw new KvDamagedError(file, e);
    }
    if (isValueDamage(e)) {
      if (!warnedFiles.has(file)) {
        warnedFiles.add(file);
        warning(
          `Ignoring a damaged entry in the Quarto cache ${file} (${message}); it will be recomputed.`,
        );
      }
      return null;
    }
    throw wrap(file, e);
  }
}
