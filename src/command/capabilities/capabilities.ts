/*
 * capabilities.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { basename, join } from "../../deno_ral/path.ts";

import * as ld from "../../core/lodash.ts";
import { formatResourcePath } from "../../core/resources.ts";

import { pandocListFormats } from "../../core/pandoc/pandoc-formats.ts";
import { JupyterCapabilitiesEx } from "../../core/jupyter/types.ts";
import { jupyterCapabilities } from "../../core/jupyter/capabilities.ts";
import { jupyterKernelspecs } from "../../core/jupyter/kernels.ts";

export interface Capabilities {
  formats: string[];
  themes: string[];
  python?: JupyterCapabilitiesEx;
}

export async function capabilities(): Promise<Capabilities> {
  const caps = {
    formats: await formats(),
    themes: await themes(),
    python: await jupyterCapabilities(),
  };

  // provide extended capabilities
  if (caps.python) {
    const pythonEx = caps.python as JupyterCapabilitiesEx;
    if (pythonEx.jupyter_core) {
      pythonEx.kernels = Array.from((await jupyterKernelspecs()).values());
    }
    pythonEx.venv = !pythonEx.conda;
  }

  return caps;
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
    "epub",
    "dashboard",
    "email",
  ];

  const excludedFormats = [
    "bibtex",
    "biblatex",
    "csljson",
  ];

  return ld.difference(
    commonFormats.concat(ld.difference(formats, commonFormats)),
    excludedFormats,
  );
}

async function themes() {
  const themesPath = formatResourcePath("html", join("bootstrap", "themes"));
  const themes: string[] = ["default"];
  const kScss = ".scss";
  for await (const dirEntry of Deno.readDir(themesPath)) {
    if (dirEntry.isFile && dirEntry.name.endsWith(kScss)) {
      themes.push(basename(dirEntry.name, kScss));
    }
  }
  return themes;
}
