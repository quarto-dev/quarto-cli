/*
 * platform.ts
 *
 * Copyright (C) 2020-2024 Posit Software, PBC
 */

export const isWindows = Deno.build.os === "windows";
export const isMac = Deno.build.os === "darwin";
export const isLinux = Deno.build.os === "linux";

export const os = Deno.build.os;
