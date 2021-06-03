/*
* observable.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Metadata } from "../../config/metadata.ts";
import { partitionMarkdown } from "../../core/pandoc/pandoc-partition.ts";
import { readYamlFromMarkdownFile } from "../../core/yaml.ts";
import {
  DependenciesOptions,
  ExecuteOptions,
  ExecutionEngine,
  kQmdExtensions,
  PostProcessOptions,
} from "../engine.ts";
import { lines } from "../../core/text.ts";
import { shortUuid } from "../../core/uuid.ts";
import { includesForObservableDependencies } from "../../core/observable/includes.ts";
import * as ojsSourceIncludes from "../../core/observable/js-source.ts";
import { breakQuartoMd } from "../../core/break-quarto-md.ts";
import { logError } from "../../core/log.ts";

function escapeBackticks(str: String) {
  return str.replaceAll(/`/g, '\\`').replaceAll(/\$/g, '\\$');
}

export const observableEngine: ExecutionEngine = {
  name: "observable",

  defaultExt: ".qmd",

  defaultYaml: () => [],

  validExtensions: () => kQmdExtensions,

  claimsExtension: (_ext: string) => {
    return false;
  },
  claimsLanguage: (language: string) => {
    return language === "ojs";
  },

  target: (file: string) => {
    return Promise.resolve({ source: file, input: file });
  },

  metadata: (file: string) =>
    Promise.resolve(readYamlFromMarkdownFile(file) as Metadata),

  partitionedMarkdown: (file: string) => {
    return Promise.resolve(partitionMarkdown(Deno.readTextFileSync(file)));
  },

  execute: (options: ExecuteOptions) => {
    // read markdown
    const markdown = Deno.readTextFileSync(options.target.input);
    const dependencies = includesForObservableDependencies();

    let ojsCellID = 0;

    let needsPreamble = true;
    let insideOjsCell: Boolean = false;

    let uuid = "";

    let output = breakQuartoMd(markdown, "ojs");
    Deno.writeTextFileSync("./debug-break-quarto-md.json", JSON.stringify(output, null, 2));

    let ls = [];
    // now we convert it back
    for (const cell of output.cells) {
      if (cell.cell_type === "raw" ||
          cell.cell_type === "markdown") {
        ls.push(cell.source.join(""));
      } else if (cell.cell_type?.language === "ojs") {
        ojsCellID += 1;
        const content = [
          '```{=html}\n',
          `<div id='ojs-cell-${ojsCellID}'></div>\n`,
          `<script type='module'>\n`];
        if (needsPreamble) {
          needsPreamble = false;
          content.push(ojsSourceIncludes.imports);
          content.push(ojsSourceIncludes.preamble);
        }
        content.push(`window._ojsRuntime.setTargetElement(document.getElementById("ojs-cell-${ojsCellID}"));\n`)
        content.push("window._ojsRuntime.interpret(`\n");
        content.push(cell.source.map(escapeBackticks).join(""));
        content.push("`);\n</script>\n```\n");
        ls.push(content.join(""));
      } else {
        logError({
          name: "breakQuartoMd",
          message: `Skipping unrecognized cell type: ${JSON.stringify(cell.cell_type)}`
        });
      }
    }
    
    return Promise.resolve({
      markdown: ls.join("\n"),

      dependencies: {
        ...dependencies,
        type: "includes",
      },
      supporting: [],
      filters: [],
    });
  },
  dependencies: (_options: DependenciesOptions) => {
    return Promise.resolve({
      includes: {},
    });
  },
  postprocess: (_options: PostProcessOptions) => Promise.resolve(),

  canFreeze: false,

  canKeepMd: true,

  renderOnChange: true,
};
