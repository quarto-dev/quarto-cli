/*
* bin.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { execProcess } from "../../core/process.ts";
import { binaryPath } from "../../core/resources.ts";

import { tinyTexInstallDir } from "../install/tools/tinytex.ts";
import { tlVersion } from "../render/latexmk/texlive.ts";
import { QuartoConfig, quartoConfig } from "../../core/quarto.ts";
import { EnvironmentData, EnvironmentDataOutputOptions } from "./cmd.ts";
import { dartSassInstallDir, dartSassVersion } from "../../core/dart-sass.ts";

export function tinyTexEnv() {
  return {
    name: "TeXLive",
    path: () => {
      return Promise.resolve(tinyTexInstallDir());
    },
    version: () => {
      return tlVersion();
    },
    options: { newline: true },
  };
}

export function dartSassEnv() {
  return {
    name: "Dart Sass",
    path: () => {
      return Promise.resolve(dartSassInstallDir());
    },
    version: () => {
      return dartSassVersion();
    },
    options: { newline: false },
  };
}

export function binaryEnv(
  name: string,
  cmd: string,
  options?: EnvironmentDataOutputOptions,
): EnvironmentData {
  return {
    name,
    path: () => {
      return Promise.resolve(binaryPath(cmd));
    },
    version: async () => {
      const res = await execProcess({
        cmd: [binaryPath(cmd), "--version"],
        stdout: "piped",
        stderr: "piped",
      });
      return res.stdout;
    },
    options,
  };
}

export function QuartoEnv(config: QuartoConfig): EnvironmentData {
  return {
    name: "Quarto",
    path: () => {
      return Promise.resolve(
        {
          bin: quartoConfig.binPath(),
          share: quartoConfig.sharePath(),
        },
      );
    },
    version: () => {
      return Promise.resolve(
        config.isDebug() ? "DEBUG" : quartoConfig.version(),
      );
    },
    options: { newline: true },
  };
}
