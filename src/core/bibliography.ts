/*
 * bibliography.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 * Copyright (c) 2016-2021 Thomas Watson Steen
 *
 * Adapted from: https://github.com/watson/ci-info
 */

import { dirname, extname, isAbsolute, join } from "../deno_ral/path.ts";
import { kBibliography } from "../config/constants.ts";
import { Metadata } from "../config/types.ts";
import { asArray } from "./array.ts";
import { CSL } from "./csl.ts";

import { FAILSAFE_SCHEMA, loadAll, Type } from "yaml";

import { execProcess } from "./process.ts";
import { pandocBinaryPath } from "./resources.ts";

// Keeps every scalar as written and, like pandoc, accepts any tag (!!int,
// !custom, ...) by keeping the untagged value
const kBibliographyYamlSchema = FAILSAFE_SCHEMA.extend(
  (["scalar", "sequence", "mapping"] as const).map((kind) =>
    new Type("", {
      kind,
      multi: true,
      construct: (data: unknown) => data ?? "",
    })
  ),
);

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
  const result = await execProcess(
    { cmd: cmd[0], args: cmd.slice(1), stdout: "piped", stderr: "piped" },
    cslStr,
  );
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
  const result = await execProcess(
    { cmd: cmd[0], args: cmd.slice(1), stdout: "piped", stderr: "piped" },
    cslStr,
  );
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
    const absBiblioPath = isAbsolute(biblioPath)
      ? biblioPath
      : join(Deno.cwd(), biblioPath);
    const ext = extname(biblioPath).toLowerCase();
    const cmd = [pandocBinaryPath()];
    let stdin: string | undefined;
    if (ext === ".json") {
      // Without -f, pandoc reads a .json input as its own JSON AST
      cmd.push("-f", "csljson", absBiblioPath);
    } else if (ext === ".yaml" || ext === ".yml") {
      // Pandoc has no reader for a YAML bibliography: read as markdown, it
      // only works when wrapped in --- delimiters. Like --bibliography, use
      // the first YAML document, either a references: map or a bare array.
      // json: true lets a duplicate key win last, as pandoc does.
      const firstDoc = loadAll(Deno.readTextFileSync(absBiblioPath), null, {
        schema: kBibliographyYamlSchema,
        json: true,
      })?.[0];
      if (Array.isArray(firstDoc)) {
        // --metadata-file needs a map, so wrap the array in a metadata block
        // for pandoc's YAML reader to parse its fields as it would the map
        cmd.push("-f", "markdown");
        stdin = `---\n${JSON.stringify({ references: firstDoc })}\n---\n`;
      } else {
        cmd.push("-f", "markdown", `--metadata-file=${absBiblioPath}`);
        stdin = "";
      }
    } else {
      cmd.push(absBiblioPath);
    }
    cmd.push("-t");
    cmd.push("csljson");
    cmd.push("--citeproc");

    const result = await execProcess(
      {
        cmd: cmd[0],
        args: cmd.slice(1),
        stdout: "piped",
        stderr: "piped",
        cwd: dir,
      },
      stdin,
    );
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
  // Pandoc resolves a repeated id to the entry from the later bibliography,
  // so keep that entry, at the position where the id first appeared.
  const uniqueEntries: CSL[] = [];
  const positions = new Map<string, number>();
  for (const entry of bibloEntries) {
    const position = entry.id === undefined
      ? undefined
      : positions.get(entry.id);
    if (position !== undefined) {
      uniqueEntries[position] = entry;
    } else {
      if (entry.id !== undefined) {
        positions.set(entry.id, uniqueEntries.length);
      }
      uniqueEntries.push(entry);
    }
  }
  return uniqueEntries;
}
