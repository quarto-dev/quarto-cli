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
import { asHtmlId } from "../html.ts";

import {
  kCodeFold,
  kEcho,
  kError,
  kEval,
  kFold,
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
      `\`, "ojs-${inlineStr}cell-${ojsCellID}", ${inline});`,
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
          label = asHtmlId(label);
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
      let userId = userCellId();
      let div = pandocDiv({
        id: cell.options?.["fig.subcap"] ? userId : undefined,
        classes: ["cell"],
      });
      let evalVal = firstDefined([
        cell.options?.[kEval],
        options.format.execute[kEval],
        true,
      ]);
      let echoVal = firstDefined([
        cell.options?.[kEcho],
        options.format.execute[kEcho],
        true,
      ]);
      let outputVal = firstDefined([
        cell.options?.[kOutput],
        options.format.execute[kOutput],
        true,
      ]);

      if (!evalVal || echoVal) {
        const classes = ["js", "cell-code"];
        const attrs = [];
        // FIXME this doesn't look to be working. Ask
        if (!outputVal) {
          classes.push("hidden");
        }

        // options.format.render?.[kCodeFold] appears to use "none"
        // for "not set", so we interpret "none" as undefined
        if (
          firstDefined([
            asUndefined(options.format.render?.[kCodeFold], "none"),
            cell.options?.[kFold],
          ])
        ) {
          attrs.push('fold="true"');
        }

        const innerDiv = pandocCode({ classes, attrs });

        innerDiv.push(pandocRawStr(cell.source.join("")));
        div.push(innerDiv);
      }
      if (evalVal) {
        scriptContents.push(interpret(cell.source, false));
      }

      if (cell.options?.["fig.subcap"]) {
        let subcaps = cell.options["fig.subcap"] as string[];
        let subfigIx = 1;
        for (const subcap of subcaps) {
          let outputDiv = pandocDiv({
            id: `${userId}-${subfigIx}`,
            classes: ["cell-output-display"],
          });
          let ojsDiv = pandocDiv({
            id: `${ojsId}-${subfigIx}`,
          });
          subfigIx++;
          outputDiv.push(ojsDiv);
          outputDiv.push(pandocRawStr(subcap as string));
          div.push(outputDiv);
        }
        if (cell.options?.["fig.cap"]) {
          div.push(pandocRawStr(cell.options["fig.cap"] as string));
        }
      } else {
        let outputDiv = pandocDiv({
          id: cell.options?.["fig.subcap"] ? undefined : userId,
          classes: ["cell-output-display"],
        });
        div.push(outputDiv);
        outputDiv.push(pandocDiv({
          id: ojsId,
        }));
        if (cell.options?.["fig.cap"]) {
          outputDiv.push(pandocRawStr(cell.options["fig.cap"] as string));
        }
      }

      div.emit(ls);
    } else {
      ls.push(`\n\`\`\`{${cell.cell_type.language}}`);
      ls.push(cell.source.map(inlineInterpolation).join(""));
      ls.push("```");
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

function asUndefined(value: any, test: any) {
  if (value === test) {
    return undefined;
  }
  return value;
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
      attrs?: string[];
    } | undefined,
  ) {
    let { id, classes, attrs } = opts || {};
    if (classes === undefined) {
      classes = [];
    }
    if (attrs === undefined) {
      attrs = [];
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
      if (attrs) {
        strs.push(...attrs);
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
