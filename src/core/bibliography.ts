/*
 * bibliography.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 * Copyright (c) 2016-2021 Thomas Watson Steen
 *
 * Adapted from: https://github.com/watson/ci-info
 */

import { dirname, isAbsolute, join } from "../deno_ral/path.ts";
import { kBibliography } from "../config/constants.ts";
import { Metadata } from "../config/types.ts";
import { asArray } from "./array.ts";
import { CSL } from "./csl.ts";

import { execProcess } from "./process.ts";
import { pandocBinaryPath } from "./resources.ts";

export async function bibliographyCslJson(input: string, metadata: Metadata) {
  const bibliography = metadata[kBibliography] as string | string[];
  if (bibliography) {
    const references = await renderToCSLJSON(
      dirname(input),
      asArray<string>(bibliography),
    );
    return references;
  }
}

export async function renderHtml(entry: CSL, csl?: string) {
  const cmd = [pandocBinaryPath()];
  cmd.push("-f");
  cmd.push("csljson");
  cmd.push("-t");
  cmd.push("html5");
  cmd.push("--citeproc");
  if (csl) {
    cmd.push("--csl");
    cmd.push(csl);
  }

  const cslStr = JSON.stringify([entry], undefined, 2);
  const result = await execProcess(cmd[0], {
    args: cmd.slice(1),
    stdout: "piped",
    stderr: "piped",
  }, cslStr);
  if (result.success) {
    return result.stdout;
  } else {
    throw new Error(
      `Failed to render citation: error code ${result.code}\n${result.stderr}`,
    );
  }
}

export async function renderBibTex(entry: CSL) {
  const cmd = [pandocBinaryPath()];
  cmd.push("-f");
  cmd.push("csljson");
  cmd.push("-t");
  cmd.push("biblatex");
  cmd.push("--citeproc");

  const cslStr = JSON.stringify([entry], undefined, 2);
  const result = await execProcess(cmd[0], {
    args: cmd.slice(1),
    stdout: "piped",
    stderr: "piped",
  }, cslStr);
  if (result.success) {
    return result.stdout;
  } else {
    throw new Error(
      `Failed to generate bibtex, rendering failed with code ${result.code}\n${result.stderr}`,
    );
  }
}

export async function renderToCSLJSON(
  dir: string,
  biblios: string[],
): Promise<CSL[]> {
  const bibloEntries = [];
  for (const biblio of biblios) {
    // The bibliopath might end up as an absolute path
    // in which case just leave it alone (otherwise it is cwd relative)
    const biblioPath = join(dir, biblio);
    const cmd = [pandocBinaryPath()];
    cmd.push(
      isAbsolute(biblioPath) ? biblioPath : join(Deno.cwd(), biblioPath),
    );
    cmd.push("-t");
    cmd.push("csljson");
    cmd.push("--citeproc");

    const result = await execProcess(cmd[0], {
      args: cmd.slice(1),
      stdout: "piped",
      stderr: "piped",
      cwd: dir,
    });
    if (result.success) {
      if (result.stdout) {
        const entries = JSON.parse(result.stdout);
        bibloEntries.push(...entries);
      }
    } else {
      throw new Error(
        `Failed to generate bibliography, rendering failed with code ${result.code}\n${result.stderr}`,
      );
    }
  }
  return bibloEntries;
}
