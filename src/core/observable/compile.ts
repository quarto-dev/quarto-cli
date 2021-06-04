/*
* compile.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { dirname, join } from "path/mod.ts";

import { Format } from "../../config/format.ts";

import { logError } from "../../core/log.ts";
import { escapeBackticks } from "../../core/text.ts";
import { breakQuartoMd } from "../../core/break-quarto-md.ts";
import { PandocIncludes } from "../../execute/engine.ts";
import { formatResourcePath } from "../resources.ts";
import { resolveDependencies } from "../../command/render/pandoc.ts";
import { kIncludeAfterBody, kIncludeInHeader } from "../../config/constants.ts";
import { sessionTempFile } from "../temp.ts";

export interface ObserveableCompileOptions {
  source: string;
  format: Format;
  markdown: string;
  libDir: string;
}

export interface ObservableCompileResult {
  markdown: string;
  includes?: PandocIncludes;
}

// TODO decide how source code is presented, we've lost this
// feature from the observable-engine move
export function observableCompile(
  options: ObserveableCompileOptions,
): ObservableCompileResult {
  const { markdown } = options;
  let output = breakQuartoMd(markdown, "ojs");

  // skip if there are no ojs chunks
  if (
    !output.cells.find((cell) =>
      cell.cell_type !== "raw" && cell.cell_type !== "markdown" &&
      cell.cell_type !== "math" &&
      cell.cell_type.language === "ojs"
    )
  ) {
    return { markdown };
  }

  let ojsCellID = 0;

  let scriptContents: string[] = [];

  function interpret(jsSrc: string[], inline: boolean) {
    let inlineStr = inline ? "inline-" : "";
    let content = [
      "window._ojsRuntime.interpret(`",
      jsSrc.map(escapeBackticks).join(""),
      `\`, document.getElementById("ojs-${inlineStr}cell-${ojsCellID}"), ${inline});`,
    ];
    return content.join("");
  }

  const inlineOJSInterpRE = /\$\{([^}]+)\}([^$])/g;
  function inlineInterpolation(str: string) {
    return str.replaceAll(inlineOJSInterpRE, function (m, g1, g2) {
      ojsCellID += 1;
      let result = [
        `<span id="ojs-inline-cell-${ojsCellID}" class="ojs-inline"></span>`,
        g2,
      ];
      scriptContents.push(interpret([g1], true));
      return result.join("");
    });
  }
  let ls = [];
  // now we convert it back
  for (const cell of output.cells) {
    if (
      cell.cell_type === "raw" ||
      cell.cell_type === "markdown"
    ) {
      ls.push(cell.source.map(inlineInterpolation).join(""));
    } else if (cell.cell_type === "math") {
      ls.push("\n$$", cell.source, "$$\n");
    } else if (cell.cell_type?.language === "ojs") {
      ojsCellID += 1;
      const content = [
        "```{=html}\n",
        `<div id='ojs-cell-${ojsCellID}'></div>\n\`\`\`\n`,
      ];
      scriptContents.push(interpret(cell.source, false));
      ls.push(content.join(""));
    } else {
      logError({
        name: "breakQuartoMd",
        message: `Skipping unrecognized cell type: ${
          JSON.stringify(cell.cell_type)
        }`,
      });
    }
  }

  // script to append
  const afterBody = [`<script type="module">`, ...scriptContents, `</script>`]
    .join("\n");
  const includeAfterBodyFile = sessionTempFile();
  Deno.writeTextFileSync(includeAfterBodyFile, afterBody);

  // copy observable dependencies and inject references to them into the head
  const includeInHeaderFile = resolveDependencies(
    [observableFormatDependency()],
    dirname(options.source),
    options.libDir,
  );

  return {
    markdown: ls.join("\n"),
    includes: {
      [kIncludeInHeader]: [includeInHeaderFile],
      [kIncludeAfterBody]: [includeAfterBodyFile],
    },
  };
}

function observableFormatDependency() {
  const observableResource = (resource: string) =>
    formatResourcePath(
      "html",
      join("observable", resource),
    );
  const observableDependency = (
    resource: string,
    attribs?: Record<string, string>,
  ) => ({
    name: resource,
    path: observableResource(resource),
    attribs,
  });

  return {
    name: "quarto-observable",
    stylesheets: [
      observableDependency("quarto-observable.css"),
    ],
    scripts: [
      observableDependency("quarto-observable.js", { type: "module" }),
    ],
  };
}
