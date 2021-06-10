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
  kKeepHidden,
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

  function interpret(jsSrc: string[], inline: boolean, lenient: boolean) {
    const inlineStr = inline ? "inline-" : "";
    const methodName = lenient ? "interpretLenient" : "interpret";
    const content = [
      `window._ojsRuntime.${methodName}(\``,
      jsSrc.map(escapeBackticks).join(""),
      `\`, "ojs-${inlineStr}cell-${ojsCellID}", ${inline});`,
    ];
    return content.join("");
  }

  const inlineOJSInterpRE = /\$\{([^}]+)\}([^$])/g;
  function inlineInterpolation(str: string, lenient: boolean) {
    return str.replaceAll(inlineOJSInterpRE, function (m, g1, g2) {
      ojsCellID += 1;
      const result = [
        `<span id="ojs-inline-cell-${ojsCellID}" class="ojs-inline"></span>`,
        g2,
      ];
      scriptContents.push(interpret([g1], true, lenient));
      return result.join("");
    });
  }
  const ls: string[] = [];
  // now we convert it back
  for (const cell of output.cells) {
    const errorVal = firstDefined([
      cell.options?.[kError],
      options.format.execute[kError],
      false
    ]);
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
          const label = asHtmlId(cell.options.label as string);
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
      const ojsId = bumpOjsCellIdString();
      const userId = userCellId();
      const attrs = [];
      
      let keysToSkip = new Set([
        "label",
        "fig.cap",
        "fig.subcap",
        "fig.scap",
        "fig.link",
        "fig.align",
        "fig.env",
        "fig.pos",
        "fig.num",
        "fig.alt", // FIXME see if it's possible to do this right wrt accessibility
        "classes",
        "output",
        "include.hidden",
        "source.hidden", // FIXME I think this is wrong
        "plot.hidden",
        "output.hidden",
        "echo.hidden", // FIXME I think this is right
        "lst.cap",
        "lst.label",
        "fold",
        "summary",
        "classes"
      ]);
      for (const [key, value] of Object.entries(cell.options || {})) {
        if (!keysToSkip.has(key)) {
          attrs.push(`${key}="${value}"`)
        }
      }
      const div = pandocDiv({
        id: cell.options?.["fig.subcap"] ? userId : undefined,
        classes: ["cell", ...((cell.options?.classes as (undefined | string[])) || [])],
        attrs
      });
      const evalVal = firstDefined([
        cell.options?.[kEval],
        options.format.execute[kEval],
        true,
      ]);
      const echoVal = firstDefined([
        cell.options?.[kEcho],
        options.format.execute[kEcho],
        true,
      ]);
      const outputVal = firstDefined([
        cell.options?.[kOutput],
        options.format.execute[kOutput],
        true,
      ]);
      const keepHiddenVal = firstDefined([
        options.format.render[kKeepHidden],
        false
      ]);
      const includeVal = firstDefined([
        cell.options?.[kInclude],
        options.format.execute[kInclude],
        true
      ]);

      
      // handle source
      if (!evalVal // always produce div when not evaluating
        || keepHiddenVal // always produce div with keepHidden
        || echoVal // if echo
        || includeVal
         ) {
        const classes = ["js", "cell-code"];
        const attrs = [];

        //  evalVal keepHiddenVal echoVal
        //  F       F             F       => add hidden
        //  F       F             T       => don't add hidden
        //  F       T             F       => add hidden
        //  F       T             T       => don't add hidden
        //  T       F             F       => never gets here
        //  T       F             T       => don't add hidden
        //  T       T             F       => add hidden
        //  T       T             T       => don't add hidden
        // 
        // simplify the logic above to be correct for the cases where
        // we are here, and we get !echoVal
        
        if (!echoVal || !includeVal) {
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

      // only emit interpret if eval is true
      if (evalVal) {
        scriptContents.push(interpret(cell.source, false, errorVal));
      }

      // handle output of computation
      const outputCellClasses = ["cell-output-display"];
      if (!outputVal || !includeVal) {
        outputCellClasses.push("hidden");
      }
      
      if (cell.options?.["fig.subcap"]) {
        const subcaps = cell.options["fig.subcap"] as string[];
        let subfigIx = 1;
        for (const subcap of subcaps) {
          const outputDiv = pandocDiv({
            id: `${userId}-${subfigIx}`,
            classes: outputCellClasses
          });
          const ojsDiv = pandocDiv({
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
        const outputDiv = pandocDiv({
          id: cell.options?.["fig.subcap"] ? undefined : userId,
          classes: outputCellClasses
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
      ls.push(cell.source.map(s => inlineInterpolation(s, errorVal)).join(""));
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
      const strs = [];
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
        for (const entry of contents) {
          entry.emit(ls);
        }
        ls.push(`\n${delimiter}\n`);
      },
    };
  };
}

const pandocDiv = pandocBlock(":::");
const pandocCode = pandocBlock("```");
