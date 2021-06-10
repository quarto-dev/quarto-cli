/*
* capabilities.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { join } from "path/mod.ts";

import { ld } from "lodash/mod.ts";
import { formatResourcePath, resourcePath } from "../../core/resources.ts";

import { pandocListFormats } from "../../core/pandoc/pandoc-formats.ts";
import { execProcess } from "../../core/process.ts";
import { readYamlFromString } from "../../core/yaml.ts";
import { pythonBinary } from "../../execute/jupyter/jupyter.ts";

export interface Capabilities {
  formats: string[];
  themes: string[];
  python?: PythonCapabilities;
}

export interface PythonCapabilities {
  versionMajor: number;
  versionMinor: number;
  execPrefix: string;
  executable: string;
  // deno-lint-ignore camelcase
  jupyter_core: string | null;
  nbformat: string | null;
  nbclient: string | null;
  ipykernel: string | null;
  yaml: string | null;
  kernels: string[];
}

export async function capabilities(): Promise<Capabilities> {
  return {
    formats: await formats(),
    themes: await themes(),
    python: await pythonCapabilities(),
  };
}

async function formats() {
  const formats = await pandocListFormats();

  const commonFormats = [
    "html",
    "pdf",
    "docx",
    "odt",
    "pptx",
    "beamer",
    "revealjs",
    "gfm",
    "hugo",
    "epub",
  ];

  return commonFormats.concat(ld.difference(formats, commonFormats));
}

async function themes() {
  const themesPath = formatResourcePath("html", join("bootstrap", "themes"));
  const themes: string[] = [];
  for await (const dirEntry of Deno.readDir(themesPath)) {
    if (dirEntry.isDirectory) {
      themes.push(dirEntry.name);
    }
  }
  return themes;
}

async function pythonCapabilities() {
  try {
    const result = await execProcess({
      cmd: [
        pythonBinary(),
        resourcePath("capabilities/python.py"),
      ],
      stdout: "piped",
    });
    if (result.success && result.stdout) {
      const caps = readYamlFromString(result.stdout) as PythonCapabilities;
      // TODO: jupyter kernels

      return caps;
    } else {
      return undefined;
    }
  } catch {
    return undefined;
  }
}
