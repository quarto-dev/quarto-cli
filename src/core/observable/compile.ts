/*
* compile.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { dirname, join, resolve, relative } from "path/mod.ts";
import { Format, isJavascriptCompatible, kDependencies  } from "../../config/format.ts";
import { warnOnce, logError } from "../../core/log.ts";
import { breakQuartoMd } from "../../core/break-quarto-md.ts";
import { PandocIncludes } from "../../execute/engine.ts";
import { formatResourcePath } from "../resources.ts";
import { resolveDependencies } from "../../command/render/pandoc.ts";
import { kIncludeAfterBody, kIncludeInHeader } from "../../config/constants.ts";
import { sessionTempFile } from "../temp.ts";
import { languagesInMarkdown } from "../jupyter/jupyter.ts";
import { asHtmlId } from "../html.ts";
import { parseModule } from "observablehq/parser";

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
  kOutputFile,
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

interface SubfigureSpec {
  caption?: string;
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

  let ojsCellID = 0;
  let userIds: Set<string> = new Set();

  const scriptContents: string[] = [];

  let ojsRuntimeDir = resolve(dirname(options.source), options.libDir + "/observable");
  let pathToDoc = relative(ojsRuntimeDir, dirname(options.source));
  scriptContents.push(`window._ojsPathToDoc = "${pathToDoc}"`);

  function interpret(jsSrc: string[], inline: boolean, lenient: boolean) {
    const inlineStr = inline ? "inline-" : "";
    const methodName = lenient ? "interpretLenient" : "interpret";
    const content = [
      `window._ojsRuntime.${methodName}("" + `,
      jsSrc.map(s => JSON.stringify(s)).join(" + "),
      `, "ojs-${inlineStr}cell-${ojsCellID}", ${inline});`,
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
      false,
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
        function chooseId(label: string) {
          const htmlLabel = asHtmlId(label as string);
          if (userIds.has(htmlLabel)) {
            // FIXME better error handling
            throw new Error(`FATAL: duplicate label ${htmlLabel}`);
          } else {
            userIds.add(htmlLabel);
            return htmlLabel;
          }
        }
        if (cell.options?.label) {
          return chooseId(cell.options.label as string);
        } else if (cell.options?.["lst.label"]) {
          return chooseId(cell.options['lst.label'] as string);
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

      function hasFigureLabel() {
        if (!cell.options?.label) {
          return false;
        }
        return (cell.options.label as string).startsWith("fig-");
      }
      function hasFigureCaption() {
        return cell.options?.["fig.cap"];
      }
      function hasFigureSubCaptions() {
        // FIXME figure out runtime type validation. This should check
        // if fig.subcap is an array of strings.
        return cell.options?.["fig.subcap"];
      }

      // very heavyweight for what we need it, but this way we can signal syntax errors
      // as well.
      let nCells = 0;
      try {
        nCells = parseModule(cell.source.join("")).cells.length;
      } catch (e) {
        if (e instanceof SyntaxError) {
          warnOnce(`observablejs Parse Error in cell source:\n\n${cell.source.join("")}\n`);
          logError(e);
        }
        throw e;
      }
      function hasManyRowsCols() {
        // FIXME figure out runtime type validation. This should check
        // if ncol and nrow are positive integers
        return cell.options?.["layout.ncol"] ||
          cell.options?.["layout.nrow"] ||
          (nCells > 1);
      }
      function nRow() {
        let row = cell.options
          ?.["layout.nrow"] as (string | number | undefined);
        if (!row) {
          return nCells;
        }
        return Number(row);
      }
      function nCol() {
        let col = cell.options
          ?.["layout.ncol"] as (string | number | undefined);
        if (!col) {
          return 1;
        }
        return Number(col);
      }
      function hasSubFigures() {
        return hasFigureSubCaptions() ||
          (hasManyRowsCols() && ((nRow() * nCol()) > 1));
      }
      function idPlacement() {
        if (hasSubFigures() ||
          cell.options?.["lst.label"]) {
          return "outer";
        } else {
          return "inner";
        }
      }
      
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
        "source.hidden",
        "plot.hidden",
        "output.hidden",
        "echo.hidden",
        "lst.cap",
        "lst.label",
        "fold",
        "summary",
        "classes",
      ]);
      for (const [key, value] of Object.entries(cell.options || {})) {
        if (!keysToSkip.has(key)) {
          attrs.push(`${key}="${value}"`);
        }
      }
      if (cell.options?.["lst.cap"]) {
        attrs.push(`caption="${cell.options?.["lst.cap"]}"`)
      }
      const div = pandocDiv({
        id: idPlacement() === "outer" ? userId : undefined,
        classes: [
          "cell",
          ...((cell.options?.classes as (undefined | string[])) || []),
        ],
        attrs,
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
        false,
      ]);
      const includeVal = firstDefined([
        cell.options?.[kInclude],
        options.format.execute[kInclude],
        true,
      ]);

      if (hasFigureCaption() && !hasFigureLabel()) {
        throw new Error("Cannot have figure caption without figure label");
      }
      if (hasFigureSubCaptions() && !hasFigureLabel()) {
        throw new Error(
          "Cannot have figure subcaptions without figure caption",
        );
      }

      // handle source
      if (
        !evalVal || // always produce div when not evaluating
        keepHiddenVal || // always produce div with keepHidden
        echoVal || // if echo
        includeVal
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

      function makeSubFigures(specs: SubfigureSpec[]) {
        let subfigIx = 1;
        for (const spec of specs) {
          const outputDiv = pandocDiv({
            classes: outputCellClasses,
          });
          const outputInnerDiv = pandocDiv({
            id: userId && `${userId}-${subfigIx}`,
          });
          const ojsDiv = pandocDiv({
            id: `${ojsId}-${subfigIx}`,
          });
          subfigIx++;
          outputDiv.push(outputInnerDiv);
          outputInnerDiv.push(ojsDiv);
          if (spec.caption) {
            outputInnerDiv.push(pandocRawStr(spec.caption as string));
          }
          div.push(outputDiv);
        }
      }

      if (!hasFigureSubCaptions() && hasManyRowsCols()) {
        let cellCount = Math.max(nRow() * nCol(), nCells, 1);
        const specs = [];
        for (let i = 0; i < cellCount; ++i) {
          specs.push({ caption: "" });
        }
        makeSubFigures(specs);
        if (cell.options?.["fig.cap"]) {
          div.push(pandocRawStr(cell.options["fig.cap"] as string));
        }
      } else if (hasFigureSubCaptions()) {
        if (
          hasManyRowsCols() &&
          (cell.options?.["fig.subcap"] as string[]).length !==
            (nRow() * nCol())
        ) {
          throw new Error(
            "Cannot have subcaptions and multi-row/col layout with mismatched number of cells",
          );
        }
        const specs = (cell.options?.["fig.subcap"] as string[]).map(
          (caption) => ({ caption }),
        );
        makeSubFigures(specs);
        if (cell.options?.["fig.cap"]) {
          div.push(pandocRawStr(cell.options["fig.cap"] as string));
        }
      } else {
        const outputDiv = pandocDiv({
          id: idPlacement() === "inner" ? userId : undefined,
          classes: outputCellClasses,
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
      ls.push(
        cell.source.map((s) => inlineInterpolation(s, errorVal)).join(""),
      );
      ls.push("```");
    }
  }

  // script to append
  const afterBody = [`<script type="module">`, ...scriptContents, `</script>`]
    .join("\n");
  const includeAfterBodyFile = sessionTempFile();
  Deno.writeTextFileSync(includeAfterBodyFile, afterBody);

  // copy observable dependencies and inject references to them into the head
  
  const extras = resolveDependencies(
    {
      html: {
        [kDependencies]: [observableFormatDependency()]
      }
    },
    dirname(options.source),
    options.libDir,
  );

  return {
    markdown: ls.join("\n"),
    filters: [
      "observable",
    ],
    includes: {
      [kIncludeInHeader]: extras?.[kIncludeInHeader] || [],
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
        return "{}";
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
