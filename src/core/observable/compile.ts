/*
* compile.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { dirname, join } from "path/mod.ts";

import { Format, isJavascriptCompatible } from "../../config/format.ts";

import { warnOnce } from "../../core/log.ts";
import { escapeBackticks } from "../../core/text.ts";
import { breakQuartoMd } from "../../core/break-quarto-md.ts";
import { PandocIncludes } from "../../execute/engine.ts";
import { formatResourcePath } from "../resources.ts";
import { resolveDependencies } from "../../command/render/pandoc.ts";
import { kIncludeAfterBody, kIncludeInHeader } from "../../config/constants.ts";
import { sessionTempFile } from "../temp.ts";

import { languagesInMarkdown } from "../jupyter/jupyter.ts";

import {
  kEcho,
  kError,
  kEval,
  kInclude,
  kOutput,
  kWarning,
} from "../../config/constants.ts";

export interface ObserveableCompileOptions {
  source: string;
  format: Format;
  markdown: string;
  libDir: string;
}

export interface ObservableCompileResult {
  markdown: string;
  filters?: string[];
  includes?: PandocIncludes;
}

// TODO decide how source code is presented, we've lost this
// feature from the observable-engine move
export function observableCompile(
  options: ObserveableCompileOptions,
): ObservableCompileResult {
  const { markdown } = options;

  if (!isJavascriptCompatible(options.format)) {
    return { markdown };
  }

  if (!languagesInMarkdown(markdown).has("observable")) {
    return { markdown };
  }

  let output = breakQuartoMd(markdown);

  // look at global and cell options for eval, echo, output, etc.
  // https://quarto.org/docs/computations/execution-options.html
  // options.format.execute[kEval];

  let ojsCellID = 0;
  let userIds: Set<string> = new Set();

  const scriptContents: string[] = [];

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
  const ls: string[] = [];
  // now we convert it back
  for (const cell of output.cells) {
    if (
      cell.cell_type === "raw" ||
      cell.cell_type === "markdown"
    ) {
      // The lua filter is in charge of this, we're a NOP.
      ls.push(cell.source.join(""));
    } else if (cell.cell_type === "math") {
      ls.push("\n$$", cell.source.join(), "$$\n");
    } else if (cell.cell_type?.language === "observable") {
      function userCellId() {
        if (cell.options?.label) {
          let label = cell.options.label as string;
          if (userIds.has(label)) {
            // FIXME better error handling
            throw new Error(`FATAL: duplicate label ${cell.options.label}`);
          } else {
            userIds.add(label);
            return label;
          }
        } else {
          return undefined;
        }
      }
      function bumpOjsCellIdString() {
        ojsCellID += 1;
        return `ojs-cell-${ojsCellID}`;
      }
      let ojsId = bumpOjsCellIdString();
      let div = pandocDiv({
        classes: ["cell"],
      });
      // FIXME typescript q: ?. syntax with square brackets?
      let evalVal = firstDefined([
        cell.options?.eval,
        options.format.execute[kEval],
        true,
      ]);
      let echoVal = firstDefined([
        cell.options?.echo,
        options.format.execute[kEcho],
        true,
      ]);
      let outputVal = firstDefined([
        cell.options?.output,
        options.format.execute[kOutput],
        true,
      ]);

      if (!evalVal || echoVal) {
        const classes = ["js", "cell-code"];
        // FIXME this doesn't look to be working. Ask
        if (!outputVal) {
          classes.push("hidden");
        }
        const innerDiv = pandocCode({ classes });

        innerDiv.push(pandocRawStr(cell.source.join("")));
        div.push(innerDiv);
      }
      if (evalVal) {
        scriptContents.push(interpret(cell.source, false));
      }
      let outputDiv = pandocDiv({
        id: userCellId(),
        classes: ["cell-output-display"],
      });
      div.push(outputDiv);

      let captionStr = "";
      if (cell.options && cell.options["fig.cap"]) {
        captionStr = `<figcaption aria-hidden="true" class="figure-caption">${
          cell.options["fig.cap"]
        }</figcaption>`;
      }
      outputDiv.push(
        pandocRawStr(
          `<figure class="figure"><div id="${ojsId}"></div>${captionStr}</figure>`,
        ),
      );
      div.emit(ls);
    } else {
      ls.push(`\n\`\`\`{${cell.cell_type.language}}`);
      ls.push(cell.source.map(inlineInterpolation).join(""));
      ls.push("```");
      // warnOnce(`Skipping unrecognized cell type: ${JSON.stringify(cell.cell_type)}`);
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
    filters: [
      "observable",
    ],
    includes: {
      [kIncludeInHeader]: [includeInHeaderFile],
      [kIncludeAfterBody]: [includeAfterBodyFile],
    },
  };
}

function firstDefined(lst: any[]) {
  for (const el of lst) {
    if (el !== undefined) {
      return el;
    }
  }
  return undefined;
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

// minimal pandoc emitting code

interface PandocNode {
  emit: (s: string[]) => void;
}

function pandocRawStr(content: string) {
  return {
    emit: (ls: string[]) => ls.push(content),
  };
}

function pandocBlock(delimiter: string) {
  return function (
    opts: {
      id?: string;
      classes?: string[];
    } | undefined,
  ) {
    let { id, classes } = opts || {};
    if (classes === undefined) {
      classes = [];
    }

    const contents: PandocNode[] = [];
    function attrString() {
      let strs = [];
      if (id) {
        strs.push(`#${id}`);
      }
      if (classes) {
        strs.push(...classes.map((c) => `.${c}`));
      }
      if (strs.length) {
        return `{${strs.join(" ")}}`;
      } else {
        return "";
      }
    }

    return {
      push: function (s: PandocNode) {
        contents.push(s);
      },
      emit: function (ls: string[]) {
        ls.push(`\n${delimiter}${attrString()}`);
        for (let entry of contents) {
          entry.emit(ls);
        }
        ls.push(`\n${delimiter}\n`);
      },
    };
  };
}

let pandocDiv = pandocBlock(":::");
let pandocCode = pandocBlock("```");
