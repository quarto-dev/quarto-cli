/*
 * devconfig.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { error, info } from "log/mod.ts";
import { join } from "path/mod.ts";
import { ensureDirSync, existsSync } from "fs/mod.ts";

import { md5Hash } from "./hash.ts";

import { isWindows } from "./platform.ts";
import { quartoConfig } from "./quarto.ts";
import { normalizePath } from "./path.ts";

const kDevConfig = "dev-config";

export interface DevConfig {
  deno: string;
  deno_dom: string;
  pandoc: string;
  dartsass: string;
  esbuild: string;
  typst: string;
  script: string;
  importMap: string; // import map for most imports, which we need on dev version
  bundleImportMap: string; // import map for dynamic imports which we need on bundled versions
}

export function createDevConfig(
  deno: string,
  deno_dom: string,
  pandoc: string,
  dartsass: string,
  esbuild: string,
  typst: string,
  scriptDir: string,
): DevConfig {
  const scriptPath = join(scriptDir, "quarto" + (isWindows() ? ".cmd" : ""));
  const srcDir = Deno.env.get("QUARTO_SRC_PATH") ||
    join(quartoConfig.sharePath(), "../../src");
  return {
    deno,
    deno_dom,
    pandoc,
    dartsass,
    esbuild,
    typst,
    script: md5Hash(Deno.readTextFileSync(scriptPath)),
    importMap: md5Hash(
      Deno.readTextFileSync(
        join(srcDir, "import_map.json"),
      ),
    ),
    bundleImportMap: md5Hash(
      Deno.readTextFileSync(
        join(srcDir, "resources/vendor/import_map.json"),
      ),
    ),
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
  const rootDir = Deno.env.get("QUARTO_ROOT") ||
    join(quartoConfig.sharePath(), "../../src");
  const configurationScript = join(
    rootDir,
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

  return createDevConfig(
    readConfig("DENO"),
    readConfig("DENO_DOM"),
    readConfig("PANDOC"),
    readConfig("DARTSASS"),
    readConfig("ESBUILD"),
    readConfig("TYPST"),
    quartoConfig.binPath(),
  );
}

export function devConfigsEqual(a: DevConfig, b: DevConfig) {
  return a.deno === b.deno &&
    a.deno_dom === b.deno_dom &&
    a.pandoc === b.pandoc &&
    a.dartsass == b.dartsass &&
    a.esbuild == b.esbuild &&
    a.typst === b.typst &&
    a.script == b.script &&
    a.importMap === b.importMap &&
    a.bundleImportMap === b.bundleImportMap;
}

export async function reconfigureQuarto(
  installed: DevConfig | null,
  source: DevConfig,
) {
  // Running configuration from within quarto does not work on windows
  // because deno.exe is running and this lock and prevent reinstallation
  // So we fail and print comment to run
  if (isWindows()) {
    error(
      `Quarto requires reconfiguration to ${
        reconfigureReason(installed, source)
      }. Please run \`./configure.cmd\` command.\n`,
    );
    return;
  }
  // Leaving Windows here if we find a way to reconfigure
  // to not forget how to call the script
  const configureScript = isWindows()
    ? ["cmd", "/c", ".\\configure.cmd"]
    : ["./configure.sh"];

  const quartoDir = normalizePath(
    join(quartoConfig.sharePath(), "..", ".."),
  );

  const process = Deno.run({
    cmd: configureScript,
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
  } else if (installed.deno_dom !== source.deno_dom) {
    return versionMessage("Deno Dom", source.deno_dom);
  } else if (installed.pandoc !== source.pandoc) {
    return versionMessage("Pandoc", source.pandoc);
  } else if (installed.dartsass !== source.dartsass) {
    return versionMessage("Dart Sass", source.dartsass);
  } else if (installed.esbuild !== source.esbuild) {
    return versionMessage("Esbuild", source.esbuild);
  } else if (installed.typst !== source.typst) {
    return versionMessage("Typst", source.typst);
  } else if (installed.script !== source.script) {
    return "update Quarto wrapper script";
  } else if (
    installed.importMap !== source.importMap ||
    installed.bundleImportMap !== source.importMap
  ) {
    return "update dev import map";
  }
}
