// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

// Keep this up-to-date with Deno.build.os
/**
 * Operating system type, equivalent to the type of
 * {@linkcode https://deno.land/api?s=Deno.build | Deno.build.os}.
 */
type OSType =
  | "darwin"
  | "linux"
  | "windows"
  | "freebsd"
  | "netbsd"
  | "aix"
  | "solaris"
  | "illumos"
  | "android";

function getOsType(): OSType {
  // deno-lint-ignore no-explicit-any
  return (globalThis as any).Deno?.build.os ||
    (navigator.userAgent.includes("Win") ? "windows" : "linux");
}

export const isWindows: boolean = getOsType() === "windows";
