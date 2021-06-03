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

import { includesForObservableDependencies } from "../../core/observable/includes.ts";
import * as ojsSourceIncludes from "../../core/observable/js-source.ts";

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
    
    let ls = lines(markdown);
    for (let i = 0; i < ls.length; ++i) {
      let l = ls[i];
      switch (insideOjsCell) {
        case false:
          if (l === "```{ojs}") {
            insideOjsCell = true;
            ojsCellID += 1;
            const content = [
              '```{=html}',
              `<div id='ojs-cell-${ojsCellID}'></div>`,
              `<script type='module'>`];
            if (needsPreamble) {
              needsPreamble = false;
              content.push(ojsSourceIncludes.imports);
              content.push(ojsSourceIncludes.preamble);
            }

            content.push(`window._ojsRuntime.setTargetElement(document.getElementById("ojs-cell-${ojsCellID}"));`)
            content.push("window._ojsRuntime.interpret(`");
            ls[i] = content.join("\n");
            for (let j = i + 1; j < ls.length; ++j) {
              let maybeCloseTicks = ls[j];
              if (ls[j] === "```") {
                // FIXME find a better way to uuid
                uuid = String(Math.random()).slice(2,);
                ls[j] = `/*${uuid}*/\n\`);\n</script>\n\`\`\``;
                break;
              }
            }
          }
          break;
        case true:
          if (ls[i].startsWith(`/*${uuid}*/`)) {
            // cut the uuid out, we're no longer inside a cell.
            ls[i] = ls[i].slice(uuid.length+4);
            insideOjsCell = false;
          } else {
            // we're inside the ojs source definition This is sent to
            // the runtime as a backtick string, so we need escaping.
            ls[i] = escapeBackticks(ls[i]); 
          }
          break;
        default:
          break;
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
