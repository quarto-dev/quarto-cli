/*
 * platform.ts
 *
 * Copyright (C) 2020-2024 Posit Software, PBC
 */

export const isWindows = Deno.build.os === "windows";
export const isMac = Deno.build.os === "darwin";
export const isLinux = Deno.build.os === "linux";

export const os = Deno.build.os;

export const arch = Deno.build.arch;

// Deno KV stores are kept per V8 release branch ("<major>.<minor>") because
// the V8 serializer format can change between branches.
export const v8Branch = Deno.version.v8.split(".").slice(0, 2).join(".");
