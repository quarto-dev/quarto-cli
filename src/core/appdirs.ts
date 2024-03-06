/*
 * appdirs.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { join } from "../deno_ral/path.ts";
import { ensureDirSync } from "fs/mod.ts";

export function quartoDataDir(subdir?: string, roaming = false) {
  return quartoDir(userDataDir, subdir, roaming);
}

export function quartoConfigDir(subdir?: string, roaming = false) {
  return quartoDir(userConfigDir, subdir, roaming);
}

export function quartoCacheDir(subdir?: string) {
  return quartoDir(userCacheDir, subdir);
}

export function quartoRuntimeDir(subdir?: string) {
  return quartoDir(userRuntimeDir, subdir);
}

function quartoDir(
  sourceFn: (appName: string, roaming?: boolean) => string,
  subdir?: string,
  roaming?: boolean,
) {
  const dir = sourceFn("quarto", roaming);
  const fullDir = subdir ? join(dir, subdir) : dir;
  ensureDirSync(fullDir);
  return fullDir;
}

export function userDataDir(appName: string, roaming = false) {
  switch (Deno.build.os) {
    case "darwin":
      return darwinUserDataDir(appName);
    case "windows":
      return windowsUserDataDir(appName, roaming);
    default: // assume generic unix
      // in 1.32.5 this is:
      // case "linux":
      // case "netbsd":
      // case "aix":
      // case "solaris":
      // case "illumos":
      // case "freebsd":
      return xdgUserDataDir(appName);
  }
}

export function userConfigDir(appName: string, roaming = false) {
  switch (Deno.build.os) {
    case "darwin":
      return darwinUserDataDir(appName);
    case "windows":
      return windowsUserDataDir(appName, roaming);
    default: // assume generic unix
      // in 1.32.5 this is:
      // case "linux":
      // case "netbsd":
      // case "aix":
      // case "solaris":
      // case "illumos":
      // case "freebsd":
      return xdgUserConfigDir(appName);
  }
}

export function userCacheDir(appName: string) {
  switch (Deno.build.os) {
    case "darwin":
      return darwinUserCacheDir(appName);
    case "windows":
      return windowsUserDataDir(appName);
    default: // assume generic unix
      // in 1.32.5 this is:
      // case "linux":
      // case "netbsd":
      // case "aix":
      // case "solaris":
      // case "illumos":
      // case "freebsd":
      return xdgUserCacheDir(appName);
  }
}

export function userRuntimeDir(appName: string) {
  switch (Deno.build.os) {
    case "darwin":
      return darwinUserCacheDir(appName);
    case "windows":
      return windowsUserDataDir(appName);
    default: // assume generic unix
      // in 1.32.5 this is:
      // case "linux":
      // case "netbsd":
      // case "aix":
      // case "solaris":
      // case "illumos":
      // case "freebsd":
      return xdgUserRuntimeDir(appName);
  }
}

function darwinUserDataDir(appName: string) {
  return join(
    Deno.env.get("HOME") || "",
    "Library",
    "Application Support",
    appName,
  );
}

function darwinUserCacheDir(appName: string) {
  return join(
    Deno.env.get("HOME") || "",
    "Library",
    "Caches",
    appName,
  );
}

function xdgUserDataDir(appName: string) {
  const dataHome = Deno.env.get("XDG_DATA_HOME") ||
    join(Deno.env.get("HOME") || "", ".local", "share");
  return join(dataHome, appName);
}

function xdgUserConfigDir(appName: string) {
  const configHome = Deno.env.get("XDG_CONFIG_HOME") ||
    join(Deno.env.get("HOME") || "", ".config");
  return join(configHome, appName);
}

function xdgUserCacheDir(appName: string) {
  const cacheHome = Deno.env.get("XDG_CACHE_HOME") ||
    join(Deno.env.get("HOME") || "", ".cache");
  return join(cacheHome, appName);
}

function xdgUserRuntimeDir(appName: string) {
  const runtimeDir = Deno.env.get("XDG_RUNTIME_DIR");
  if (runtimeDir) {
    return runtimeDir;
  } else {
    return xdgUserDataDir(appName);
  }
}

function windowsUserDataDir(appName: string, roaming = false) {
  const dir =
    (roaming ? Deno.env.get("APPDATA") : Deno.env.get("LOCALAPPDATA")) || "";
  return join(dir, appName);
}
