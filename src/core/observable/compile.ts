/*
* compile.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { ld } from "lodash/mod.ts";
import { dirname, join, relative, resolve } from "path/mod.ts";

import { parseModule } from "observablehq/parser";

import {
  Format,
  isJavascriptCompatible,
  kDependencies,
} from "../../config/format.ts";
import { logError } from "../../core/log.ts";
import { breakQuartoMd } from "../../core/break-quarto-md.ts";
import { ExecuteResult, PandocIncludes } from "../../execute/engine.ts";
import { formatResourcePath } from "../resources.ts";
import { resolveDependencies } from "../../command/render/pandoc.ts";
import { kIncludeAfterBody, kIncludeInHeader } from "../../config/constants.ts";
import { sessionTempFile } from "../temp.ts";
import { languagesInMarkdown } from "../jupyter/jupyter.ts";
import { asHtmlId } from "../html.ts";
import { extractResources } from "./extract-resources.ts";
import { parseError } from "./errors.ts";

import {
  kCellFigCap,
  kCellFigSubCap,
  kCellLstCap,
  kCellLstLabel,
  kCodeFold,
  kEcho,
  kError,
  kEval,
  kFold,
  kInclude,
  kKeepHidden,
  kLayoutNcol,
  kLayoutNrow,
  kOutput,
  kSelfContained,
} from "../../config/constants.ts";

import { RenderContext } from "../../command/render/render.ts";
import { mergeConfigs } from "../config.ts";

export interface ObserveableCompileOptions {
  source: string;
  format: Format;
  markdown: string;
  libDir: string;
  projDir?: string;
}

export interface ObservableCompileResult {
  markdown: string;
  filters?: string[];
  includes?: PandocIncludes;
  resourceFiles?: string[];
}

interface SubfigureSpec {
  caption?: string;
}

// TODO decide how source code is presented, we've lost this
// feature from the observable-engine move
export function observableCompile(
  options: ObserveableCompileOptions,
): ObservableCompileResult {
  const { markdown, projDir } = options;

  if (!isJavascriptCompatible(options.format)) {
    return { markdown };
  }

  if (!languagesInMarkdown(markdown).has("ojs")) {
    return { markdown };
  }

  if (options.format.pandoc?.[kSelfContained]) {
    throw new Error(
      "FATAL: self-contained format option not supported with OJS cells",
    );
  }

  const output = breakQuartoMd(markdown);

  let ojsCellID = 0;
  const userIds: Set<string> = new Set();

  const scriptContents: string[] = [];

  const ojsRuntimeDir = resolve(
    dirname(options.source),
    options.libDir + "/observable",
  );
  const runtimeToDoc = relative(ojsRuntimeDir, dirname(options.source));
  const runtimeToRoot = relative(ojsRuntimeDir, "./");
  scriptContents.push(`window._ojs.paths.runtimeToDoc = "${runtimeToDoc}"`);
  scriptContents.push(`window._ojs.paths.runtimeToRoot = "${runtimeToRoot}"`);

  function interpret(jsSrc: string[], inline: boolean, lenient: boolean) {
    const inlineStr = inline ? "inline-" : "";
    const methodName = lenient ? "interpretLenient" : "interpret";
    const content = [
      `window._ojs.runtime.${methodName}("" + `,
      jsSrc.map((s) => JSON.stringify(s)).join(" + "),
      `, "ojs-${inlineStr}cell-${ojsCellID}", ${inline});`,
    ];
    return content.join("");
  }

  const inlineOJSInterpRE = /\$\{([^}]+)\}([^$])/g;
  function inlineInterpolation(str: string, lenient: boolean) {
    return str.replaceAll(inlineOJSInterpRE, function (_m, g1, g2) {
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
  const resourceFiles: string[] = [];

  // now we convert it back
  for (const cell of output.cells) {
    const cellSrcStr = cell.source.join("");
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
      ls.push(cellSrcStr);
    } else if (cell.cell_type === "math") {
      ls.push("\n$$", cellSrcStr, "$$\n");
    } else if (cell.cell_type?.language === "ojs") {
      const userCellId = () => {
        const chooseId = (label: string) => {
          const htmlLabel = asHtmlId(label as string);
          if (userIds.has(htmlLabel)) {
            // FIXME explain error better to avoid confusion
            // that might come up under id canonicalization
            throw new Error(`FATAL: duplicate label ${htmlLabel}`);
          } else {
            userIds.add(htmlLabel);
            return htmlLabel;
          }
        };
        if (cell.options?.label) {
          return chooseId(cell.options.label as string);
        } else if (cell.options?.[kCellLstLabel]) {
          return chooseId(cell.options[kCellLstLabel] as string);
        } else {
          return undefined;
        }
      };
      const bumpOjsCellIdString = () => {
        ojsCellID += 1;
        return `ojs-cell-${ojsCellID}`;
      };
      const ojsId = bumpOjsCellIdString();
      const userId = userCellId();
      const attrs = [];

      const hasFigureLabel = () => {
        if (!cell.options?.label) {
          return false;
        }
        return (cell.options.label as string).startsWith("fig-");
      };
      const hasFigureCaption = () => {
        return cell.options?.[kCellFigCap];
      };
      const hasFigureSubCaptions = () => {
        // FIXME figure out runtime type validation. This should check
        // if fig.subcap is an array of strings.
        //
        // WAITING for YAML schemas + validation
        return cell.options?.[kCellFigSubCap];
      };

      resourceFiles.push(...extractResources(
        cellSrcStr,
        options.source,
        projDir,
      ));

      // very heavyweight for what we need it, but this way we can signal syntax errors
      // as well.
      let nCells = 0;
      try {
        nCells = parseModule(cellSrcStr).cells.length;
      } catch (e) {
        if (e instanceof SyntaxError) {
          parseError(cellSrcStr);
        } else {
          logError(e);
        }
        throw new Error();
      }
      const hasManyRowsCols = () => {
        // FIXME figure out runtime type validation. This should check
        // if ncol and nrow are positive integers
        //
        // WAITING for YAML schemas + validation
        return cell.options?.[kLayoutNcol] ||
          cell.options?.[kLayoutNrow] ||
          (nCells > 1);
      };
      const nRow = () => {
        const row = cell.options
          ?.[kLayoutNrow] as (string | number | undefined);
        if (!row) {
          return nCells;
        }
        return Number(row);
      };
      const nCol = () => {
        const col = cell.options
          ?.[kLayoutNcol] as (string | number | undefined);
        if (!col) {
          return 1;
        }
        return Number(col);
      };
      const hasSubFigures = () => {
        return hasFigureSubCaptions() ||
          (hasManyRowsCols() && ((nRow() * nCol()) > 1));
      };
      const idPlacement = () => {
        if (
          hasSubFigures() ||
          cell.options?.[kCellLstLabel]
        ) {
          return "outer";
        } else {
          return "inner";
        }
      };

      const keysToSkip = new Set([
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
      if (cell.options?.[kCellLstCap]) {
        attrs.push(`caption="${cell.options?.[kCellLstCap]}"`);
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

        innerDiv.push(pandocRawStr(cellSrcStr));
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

      const makeSubFigures = (specs: SubfigureSpec[]) => {
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
      };

      if (!hasFigureSubCaptions() && hasManyRowsCols()) {
        const cellCount = Math.max(nRow() * nCol(), nCells, 1);
        const specs = [];
        for (let i = 0; i < cellCount; ++i) {
          specs.push({ caption: "" });
        }
        makeSubFigures(specs);
        if (cell.options?.[kCellFigCap]) {
          div.push(pandocRawStr(cell.options[kCellFigCap] as string));
        }
      } else if (hasFigureSubCaptions()) {
        if (
          hasManyRowsCols() &&
          (cell.options?.[kCellFigSubCap] as string[]).length !==
            (nRow() * nCol())
        ) {
          throw new Error(
            "Cannot have subcaptions and multi-row/col layout with mismatched number of cells",
          );
        }
        const specs = (cell.options?.[kCellFigSubCap] as string[]).map(
          (caption) => ({ caption }),
        );
        makeSubFigures(specs);
        if (cell.options?.[kCellFigCap]) {
          div.push(pandocRawStr(cell.options[kCellFigCap] as string));
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
        if (cell.options?.[kCellFigCap]) {
          outputDiv.push(pandocRawStr(cell.options[kCellFigCap] as string));
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

  // finish script by calling runtime's "done with new source" handler,
  scriptContents.push("window._ojs.runtime.finishInterpreting();");

  // script to append
  const afterBody = [`<script type="module">`, ...scriptContents, `</script>`]
    .join("\n");
  const includeAfterBodyFile = sessionTempFile();
  Deno.writeTextFileSync(includeAfterBodyFile, afterBody);

  // copy observable dependencies and inject references to them into the head

  const extras = resolveDependencies(
    {
      html: {
        [kDependencies]: [observableFormatDependency()],
      },
    },
    dirname(options.source),
    options.libDir,
  );

  return {
    markdown: ls.join("\n"),
    filters: [
      "ojs",
    ],
    includes: {
      [kIncludeInHeader]: extras?.[kIncludeInHeader] || [],
      [kIncludeAfterBody]: [includeAfterBodyFile],
    },
    resourceFiles,
  };
}

export function observableExecuteResult(
  context: RenderContext,
  executeResult: ExecuteResult,
) {
  executeResult = ld.cloneDeep(executeResult);

  // evaluate observable chunks
  const { markdown, includes, filters, resourceFiles } = observableCompile({
    source: context.target.source,
    format: context.format,
    markdown: executeResult.markdown,
    libDir: context.libDir,
    projDir: context.project?.dir,
  });

  // merge in results
  executeResult.markdown = markdown;
  if (includes) {
    executeResult.includes = mergeConfigs(
      (executeResult.includes || {}, includes),
    );
  }
  if (filters) {
    executeResult.filters = (executeResult.filters || []).concat(filters);
  }

  return {
    executeResult,
    resourceFiles: resourceFiles || [],
  };
}

// deno-lint-ignore no-explicit-any
function asUndefined(value: any, test: any) {
  if (value === test) {
    return undefined;
  }
  return value;
}

// deno-lint-ignore no-explicit-any
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
      observableDependency("observable-in-a-box.js", { type: "module" }),
      observableDependency("quarto-observable-shiny.js", { type: "module" }),
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
