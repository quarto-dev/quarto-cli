/*
 * errors.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Runtime-neutral error predicates. Application code uses these instead of
 * `instanceof Deno.errors.X`. The Deno classes are matched when the Deno
 * global exists; Node-style `code` properties are matched everywhere. A
 * wrapper error (deno_ral/process.ts exec) is looked through via `cause`.
 */

function errorCode(e: unknown): string | undefined {
  if (typeof e === "object" && e !== null && "code" in e) {
    const code = (e as { code: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

type DenoErrorName =
  | "NotFound"
  | "AlreadyExists"
  | "PermissionDenied"
  | "AddrInUse"
  | "ConnectionRefused"
  | "BrokenPipe"
  | "NotConnected"
  | "ConnectionAborted"
  | "ConnectionReset";

function isDenoError(e: unknown, name: DenoErrorName): boolean {
  // deno-lint-ignore no-explicit-any
  const errors = (globalThis as any).Deno?.errors;
  const cls = errors?.[name];
  return typeof cls === "function" && e instanceof cls;
}

function matchesOne(e: unknown, names: DenoErrorName[], codes: string[]): boolean {
  const code = errorCode(e);
  if (code !== undefined && codes.includes(code)) {
    return true;
  }
  return names.some((name) => isDenoError(e, name));
}

function matches(e: unknown, names: DenoErrorName[], codes: string[]): boolean {
  if (matchesOne(e, names, codes)) {
    return true;
  }
  const cause = e instanceof Error ? e.cause : undefined;
  return cause !== undefined && matchesOne(cause, names, codes);
}

export function isNotFound(e: unknown): boolean {
  return matches(e, ["NotFound"], ["ENOENT"]);
}

export function isAlreadyExists(e: unknown): boolean {
  return matches(e, ["AlreadyExists"], ["EEXIST"]);
}

export function isPermissionDenied(e: unknown): boolean {
  return matches(e, ["PermissionDenied"], ["EACCES", "EPERM"]);
}

export function isAddrInUse(e: unknown): boolean {
  return matches(e, ["AddrInUse"], ["EADDRINUSE"]);
}

export function isConnectionRefused(e: unknown): boolean {
  return matches(e, ["ConnectionRefused"], ["ECONNREFUSED"]);
}

/** Errors a server sees when a client goes away mid-response. */
export function isConnectionError(e: unknown): boolean {
  return matches(
    e,
    [
      "BrokenPipe",
      "NotConnected",
      "ConnectionAborted",
      "ConnectionReset",
      "ConnectionRefused",
    ],
    ["EPIPE", "ENOTCONN", "ECONNABORTED", "ECONNRESET", "ECONNREFUSED"],
  );
}

/**
 * Append the offending path to an error message (idempotent).
 * core/deno/monkey-patch.ts annotates Deno.readTextFile* errors the same way;
 * the idempotence keeps the path from being appended twice.
 */
export function errorWithPath(e: Error, path: string): Error {
  const suffix = "\nPath: " + path;
  if (e.message && !e.message.endsWith(suffix)) {
    e.message = e.message + suffix;
  }
  return e;
}
