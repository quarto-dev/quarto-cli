/*
* devconfig.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { error, info } from "log/mod.ts";
import { join } from "path/mod.ts";
import { ensureDirSync, existsSync } from "fs/mod.ts";

import { md5Hash } from "./hash.ts";

import { isMac, isWindows } from "./platform.ts";
import { quartoConfig } from "./quarto.ts";

const kDevConfig = "dev-config";

export interface DevConfig {
  deno: string;
  pandoc: string;
  dartsass: string;
  esbuild: string;
  script: string;
}

export function createDevConfig(
  deno: string,
  pandoc: string,
  dartsass: string,
  esbuild: string,
  scriptDir: string,
): DevConfig {
  const scriptPath = join(scriptDir, "quarto" + (isWindows() ? ".cmd" : ""));
  return {
    deno,
    pandoc,
    dartsass,
    esbuild,
    script: md5Hash(Deno.readTextFileSync(scriptPath)),
  };
}

export function writeDevConfig(config: DevConfig, binPath: string) {
  const configPath = join(binPath, "..", "config");
  ensureDirSync(configPath);
  Deno.writeTextFileSync(
    join(configPath, kDevConfig),
    JSON.stringify(config, undefined, 2),
  );
}

export function readInstalledDevConfig(): DevConfig | null {
  const binPath = quartoConfig.binPath();
  const configPath = join(binPath, "..", "config", kDevConfig);
  if (existsSync(configPath)) {
    return JSON.parse(Deno.readTextFileSync(configPath)) as DevConfig;
  } else {
    return null;
  }
}

export function readSourceDevConfig(): DevConfig {
  const configurationScript = join(
    quartoConfig.sharePath(),
    "..",
    "..",
    "configuration",
  );
  const configurationScriptSrc = Deno.readTextFileSync(configurationScript);
  const readConfig = (key: string) => {
    const regex = new RegExp(`${key}=(\\S+)`);
    const match = configurationScriptSrc.match(regex);
    if (match) {
      return match[1];
    } else {
      return "";
    }
  };

  const srcScriptPath = join(
    quartoConfig.binPath(),
    "..",
    "..",
    "scripts",
    isWindows() ? "windows" : "common",
  );
  return createDevConfig(
    readConfig("DENO"),
    readConfig("PANDOC"),
    readConfig("DARTSASS"),
    readConfig("ESBUILD"),
    srcScriptPath,
  );
}

export function devConfigsEqual(a: DevConfig, b: DevConfig) {
  return a.deno === b.deno &&
    a.pandoc === b.pandoc &&
    a.dartsass == b.dartsass &&
    a.esbuild == b.esbuild &&
    a.script == b.script;
}

export async function reconfigureQuarto(
  installed: DevConfig | null,
  source: DevConfig,
) {
  const configureScript = isWindows()
    ? ".\\configure-windows.cmd"
    : isMac()
    ? "./configure-macos.sh"
    : "./configure-linux.sh";

  const quartoDir = Deno.realPathSync(
    join(quartoConfig.binPath(), "..", "..", ".."),
  );

  const process = Deno.run({
    cmd: [configureScript],
    cwd: quartoDir,
  });

  await process.status();

  info("");
  error(
    `Quarto required reconfiguration to ${
      reconfigureReason(installed, source)
    }. Please try command again.\n`,
  );
}

function reconfigureReason(
  installed: DevConfig | null,
  source: DevConfig,
) {
  const versionMessage = (dep: string, version: string) => {
    return `install ${dep} version ${version}`;
  };
  if (installed === null || installed.deno !== source.deno) {
    return versionMessage("Deno", source.deno);
  } else if (installed.pandoc !== source.pandoc) {
    return versionMessage("Pandoc", source.pandoc);
  } else if (installed.dartsass !== source.dartsass) {
    return versionMessage("Dart Sass", source.dartsass);
  } else if (installed.esbuild !== source.esbuild) {
    return versionMessage("Esbuild", source.esbuild);
  } else if (installed.script !== source.script) {
    return "update Quarto wrapper script";
  }
}
