/*
* appdirs.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { join } from "path/mod.ts";
import { ensureDirSync } from "fs/mod.ts";

export function userDataDir(appName: string, roaming = false) {
  let dataDir: string | undefined;
  switch (Deno.build.os) {
    case "darwin":
      dataDir = darwinUserDataDir(appName);
      break;
    case "linux":
      dataDir = xdgUserDataDir(appName);
      break;
    case "windows":
      dataDir = windowsUserDataDir(appName, roaming);
      break;
  }
  ensureDirSync(dataDir);
  return dataDir;
}

export function userConfigDir(appName: string, roaming = false) {
  let configDir: string | undefined;
  switch (Deno.build.os) {
    case "darwin":
      configDir = darwinUserDataDir(appName);
      break;
    case "linux":
      configDir = xdgUserConfigDir(appName);
      break;
    case "windows":
      configDir = windowsUserDataDir(appName, roaming);
      break;
  }
  ensureDirSync(configDir);
  return configDir;
}

export function userCacheDir(appName: string) {
  let cacheDir: string | undefined;
  switch (Deno.build.os) {
    case "darwin":
      cacheDir = darwinUserCacheDir(appName);
      break;
    case "linux":
      cacheDir = xdgUserCacheDir(appName);
      break;
    case "windows":
      cacheDir = windowsUserDataDir(appName);
      break;
  }
  ensureDirSync(cacheDir);
  return cacheDir;
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

function windowsUserDataDir(appName: string, roaming = false) {
  const dir =
    (roaming ? Deno.env.get("APPDATA") : Deno.env.get("LOCALAPPDATA")) || "";
  return join(dir, appName);
}
