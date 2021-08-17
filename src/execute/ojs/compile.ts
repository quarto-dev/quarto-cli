/*
* compile.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { ld } from "lodash/mod.ts";
import { dirname, join, relative, resolve } from "path/mod.ts";

import { parseModule } from "observablehq/parser";

import { Format, kDependencies } from "../../config/types.ts";
import { ExecuteResult, PandocIncludes } from "../../execute/types.ts";
import {
  kCellClasses,
  kCellFigAlign,
  kCellFigAlt,
  kCellFigEnv,
  kCellFigLink,
  kCellFigPos,
  kCellFigScap,
  kCellLabel,
  kCellPanel,
  kCodeSummary,
  kIncludeAfterBody,
  kIncludeInHeader,
  kSelfContained,
} from "../../config/constants.ts";
import { RenderContext } from "../../command/render/types.ts";
import { ProjectContext } from "../../project/types.ts";

import { isJavascriptCompatible } from "../../config/format.ts";

import { resolveDependencies } from "../../command/render/pandoc.ts";
import {
  extractResourceDescriptionsFromOJSChunk,
  makeSelfContainedResources,
  ResourceDescription,
  uniqueResources,
} from "./extract-resources.ts";
import { ojsParseError } from "./errors.ts";

import { ojsSimpleWalker } from "./ojs-tools.ts";

import {
  kCellFigCap,
  kCellFigSubCap,
  kCellLstCap,
  kCellLstLabel,
  kCodeFold,
  kCodeOverflow,
  kEcho,
  kError,
  kEval,
  kInclude,
  kKeepHidden,
  kLayoutNcol,
  kLayoutNrow,
  kOutput,
} from "../../config/constants.ts";

import { languagesInMarkdown } from "../../core/jupyter/jupyter.ts";
import { asHtmlId } from "../../core/html.ts";
import { sessionTempFile } from "../../core/temp.ts";
import { quartoConfig } from "../../core/quarto.ts";
import { mergeConfigs } from "../../core/config.ts";
import { formatResourcePath } from "../../core/resources.ts";
import { logError } from "../../core/log.ts";
import { breakQuartoMd, QuartoMdCell } from "../../core/break-quarto-md.ts";

export interface OjsCompileOptions {
  source: string;
  format: Format;
  markdown: string;
  libDir: string;
  project?: ProjectContext;
}

export interface OjsCompileResult {
  markdown: string;
  filters?: string[];
  includes?: PandocIncludes;
  resourceFiles?: string[];
}

interface SubfigureSpec {
  caption?: string;
}

// TODO decide how source code is presented, we've lost this
// feature from the ojs-engine move
export async function ojsCompile(
  options: OjsCompileOptions,
): Promise<OjsCompileResult> {
  const { markdown, project } = options;
  const projDir = project?.dir;

  const selfContained = options.format.pandoc?.[kSelfContained] ?? false;

  if (!isJavascriptCompatible(options.format)) {
    return { markdown };
  }

  const languages = languagesInMarkdown(markdown);
  if (!languages.has("ojs") && !languages.has("dot")) {
    return { markdown };
  }

  const output = breakQuartoMd(markdown);

  let ojsCellID = 0;
  const userIds: Set<string> = new Set();

  const scriptContents: string[] = [];

  const ojsRuntimeDir = resolve(
    dirname(options.source),
    options.libDir + "/ojs",
  );
  const docDir = dirname(options.source);
  const rootDir = projDir ?? "./";
  const runtimeToDoc = relative(ojsRuntimeDir, docDir);
  const runtimeToRoot = relative(ojsRuntimeDir, rootDir);
  const docToRoot = relative(docDir, rootDir);
  scriptContents.push(`window._ojs.paths.runtimeToDoc = "${runtimeToDoc}";`);
  scriptContents.push(`window._ojs.paths.runtimeToRoot = "${runtimeToRoot}";`);
  scriptContents.push(`window._ojs.paths.docToRoot = "${docToRoot}";`);
  scriptContents.push(
    `window._ojs.selfContained = ${selfContained};`,
  );

  interface ModuleCell {
    methodName: string;
    cellName?: string;
    inline?: boolean;
    source: string;
  }
  const moduleContents: ModuleCell[] = [];

  function interpret(jsSrc: string[], inline: boolean, lenient: boolean) {
    const inlineStr = inline ? "inline-" : "";
    const methodName = lenient ? "interpretLenient" : "interpret";
    moduleContents.push({
      methodName,
      cellName: `ojs-${inlineStr}cell-${ojsCellID}`,
      inline,
      source: jsSrc.join(""),
    });
  }

  const inlineOJSInterpRE = /\$\{([^}]+)\}([^$])/g;
  function inlineInterpolation(str: string, lenient: boolean) {
    return str.replaceAll(inlineOJSInterpRE, function (_m, g1, g2) {
      ojsCellID += 1;
      const result = [
        `<span id="ojs-inline-cell-${ojsCellID}" class="ojs-inline"></span>`,
        g2,
      ];
      interpret([g1], true, lenient);
      return result.join("");
    });
  }
  const ls: string[] = [];
  const resourceFiles: string[] = [];
  const pageResources: ResourceDescription[] = [];
  const ojsViews = new Set<string>();
  const ojsIdentifiers = new Set<string>();

  // now we convert it back
  for (const cell of output.cells) {
    const errorVal =
      (cell.options?.[kError] ?? options.format.execute?.[kError] ??
        false) as boolean;
    const handleOJSCell = (
      cell: QuartoMdCell,
      cellSrcInMd?: string,
      mdClassList?: string[],
    ) => {
      const cellSrcStr = cell.source.join("");
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
        // if fig-subcap is an array of strings.
        //
        // WAITING for YAML schemas + validation
        return cell.options?.[kCellFigSubCap];
      };

      interface SourceInfo {
        start: number,
        end: number,
        cellType: string
      };
      interface ParsedCellInfo {
        info: SourceInfo[]
      };

      const handleError = (err: any, cellSrc: string) => {
        const div = pandocBlock(':::::')({
          classes: ["quarto-ojs-syntax-error"],
        });
        const msg = String(err).split("\n")[0].trim().replace(/ *\(\d+:\d+\)$/, '');
        div.push(pandocRawStr(`<p>${msg}.</p>`));
        ojsParseError(err, cellSrc);

        const preDiv = pandocBlock("````")({
          classes: ["numberLines", "java"],
          attrs: ['startFrom="0"']
        });
        preDiv.push(pandocRawStr("```{ojs}\n" + cellSrc + "\n```"));
        div.push(preDiv);
        div.emit(ls);
      }
      
      let nCells = 0;
      let parsedCells: ParsedCellInfo[] = [];
      
      try {
        const parse = parseModule(cellSrcStr);
        let info: SourceInfo[] = [];
        const flushSeqSrc = () => {
          parsedCells.push({ info });
          for (let i = 1; i < info.length; ++i) {
            parsedCells.push({ info: [] });
          }
          info = [];
        };
        ojsSimpleWalker(parse, {
          // deno-lint-ignore no-explicit-any
          Cell(node: any) {
            if (node.id && node.id.type === "ViewExpression") {
              ojsViews.add(node.id.id.name);
            } else if (node.id && node.id.type === "Identifier") {
              ojsIdentifiers.add(node.id.name);
            }
            if (node.id === null &&
              node.body.type !== "ImportDeclaration") {
              info.push({start: node.start, end: node.end, cellType: "expression"})
              flushSeqSrc();
            } else {
              info.push({start: node.start, end: node.end, cellType: "declaration"})
            }
          },
        });
        nCells = parse.cells.length;
        if (info.length > 0) {
          flushSeqSrc();
        }
      } catch (e) {
        if (e instanceof SyntaxError) {
          handleError(e, cellSrcStr);
          return;
        } else {
          logError(e);
          throw new Error();
        }
      }

      pageResources.push(...extractResourceDescriptionsFromOJSChunk(
        cellSrcStr,
        dirname(options.source),
        projDir,
      ));

      const hasManyRowsCols = () => {
        // FIXME figure out runtime type validation. This should check
        // if ncol and nrow are positive integers
        //
        // WAITING for YAML schemas + validation
        const cols = cell.options?.[kLayoutNcol];
        const rows = cell.options?.[kLayoutNrow];
        return  (Number(cols) && (Number(cols) > 1)) ||
          (Number(rows) && (Number(rows) > 1)) ||
          (nCells > 1);
      };
      const nCol = () => {
        const col = cell.options
          ?.[kLayoutNcol] as (string | number | undefined);
        if (!col) {
          return 1;
        }
        return Number(col);
      };
      const nRow = () => {
        const row = cell.options
          ?.[kLayoutNrow] as (string | number | undefined);
        if (!row) {
          return Math.ceil(nCells / nCol());
        }
        return Number(row);
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
        kEcho,
        kCellLabel,
        kCellFigCap,
        kCellFigSubCap,
        kCellFigScap,
        kCellFigLink,
        kCellFigAlign,
        kCellFigEnv,
        kCellFigPos,
        kCellFigAlt, // FIXME see if it's possible to do this right wrt accessibility
        kOutput,
        kCellLstCap,
        kCellLstLabel,
        kCodeFold,
        kCodeSummary,
        kCodeOverflow,
        kCellClasses,
        kCellPanel,
        "include.hidden",
        "source.hidden",
        "plot.hidden",
        "output.hidden",
        "echo.hidden",
      ]);

      for (const [key, value] of Object.entries(cell.options || {})) {
        if (!keysToSkip.has(key)) {
          const t = typeof value;
          if (t === "object") {
            attrs.push(`${key}="${JSON.stringify(value)}"`);
          } else if (t === "string") {
            attrs.push(`${key}=${JSON.stringify(value)}`);
          } else if (t === "number") {
            attrs.push(`${key}="${value}"`);
          } else if (t === "boolean") {
            attrs.push(`${key}=${value}`);
          } else {
            throw new Error(`Can't serialize yaml metadata value of type ${t}`);
          }
        }
      }
      const outputVal = cell.options?.[kOutput] ??
        options.format.execute[kOutput] ?? true;
      if (outputVal === "all") {
        attrs.push(`output="all"`);
      }
      if (cell.options?.[kCellLstCap]) {
        attrs.push(`caption="${cell.options?.[kCellLstCap]}"`);
      }
      const classes = (cell.options?.classes as (undefined | string[])) || [];
      if (typeof cell.options?.panel === "string") {
        classes.push(`panel-${cell.options?.panel}`);
      }
      const div = pandocDiv({
        id: idPlacement() === "outer" ? userId : undefined,
        classes: [
          "cell",
          ...classes,
        ],
        attrs,
      });
      const evalVal = cell.options?.[kEval] ?? options.format.execute[kEval] ??
        true;
      const echoVal = cell.options?.[kEcho] ?? options.format.execute[kEcho] ??
        true;
      const keepHiddenVal = options.format.render[kKeepHidden] ?? false;
      const includeVal = cell.options?.[kInclude] ??
        options.format.execute[kInclude] ?? true;

      if (hasFigureCaption() && !hasFigureLabel()) {
        throw new Error("Cannot have figure caption without figure label");
      }
      if (hasFigureSubCaptions() && !hasFigureLabel()) {
        throw new Error(
          "Cannot have figure subcaptions without figure caption",
        );
      }

      interface SrcConfig {
        attrs: string[],
        classes: string[]
      };

      let srcConfig: undefined | SrcConfig;

      if (
        includeVal &&
        (!evalVal || // always produce div when not evaluating
          keepHiddenVal || // always produce div with keepHidden
          echoVal) // if echo
      ) {
        const classes = mdClassList ?? ["js", "cell-code"];
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

        if (!echoVal) {
          classes.push("hidden");
        }

        if (cell.options?.[kCodeOverflow] === "wrap") {
          classes.push("code-overflow-wrap");
        } else if (cell.options?.[kCodeOverflow] === "scroll") {
          classes.push("code-overflow-scroll");
        }

        // options.format.render?.[kCodeFold] appears to use "none"
        // for "not set", so we interpret "none" as undefined
        if (
          asUndefined(options.format.render?.[kCodeFold], "none") ??
            cell.options?.[kCodeFold]
        ) {
          attrs.push(`${kCodeFold}="${cell.options?.[kCodeFold]}"`);
        }

        srcConfig = {
          classes: classes.slice(),
          attrs: attrs.slice()
        };
      }

      // only emit interpret if eval is true
      if (evalVal) {
        interpret(cell.source, false, errorVal);
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
          const innerInfo = parsedCells[subfigIx-1].info;
          const attrs = innerInfo.length ? [`nodetype="${innerInfo[innerInfo.length-1].cellType}"`] : [];
          const ojsDiv = pandocDiv({
            id: `${ojsId}-${subfigIx}`,
            attrs
          });
          if (innerInfo.length > 0 && srcConfig !== undefined) {
            const srcDiv = pandocCode(srcConfig);
            srcDiv.push(pandocRawStr(
              cellSrcStr.substring(innerInfo[0].start,
                                   innerInfo[innerInfo.length-1].end)));
            div.push(srcDiv);
          }
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
        const innerInfo = parsedCells[0].info;
        if (innerInfo.length > 0 && srcConfig !== undefined) {
          const srcDiv = pandocCode(srcConfig);
          srcDiv.push(pandocRawStr(cellSrcStr.substring(innerInfo[0].start, innerInfo[0].end)));
          div.push(srcDiv);
        }
        const outputDiv = pandocDiv({
          id: idPlacement() === "inner" ? userId : undefined,
          classes: outputCellClasses,
        });
        div.push(outputDiv);
        outputDiv.push(pandocDiv({
          id: ojsId,
          attrs: [`nodetype="${innerInfo[0].cellType}"`]
        }));
        if (cell.options?.[kCellFigCap]) {
          outputDiv.push(pandocRawStr(cell.options[kCellFigCap] as string));
        }
      }

      div.emit(ls);
    };

    if (
      cell.cell_type === "raw" ||
      cell.cell_type === "markdown" ||
      cell.cell_type === "math"
    ) {
      // The lua filter is in charge of this, we're a NOP.
      ls.push(cell.source.join(""));
    } else if (cell.cell_type?.language === "dot") {
      const newCell = {
        ...cell,
        "cell_type": {
          language: "ojs",
        },
        source: ["dot`\n", ...cell.source, "\n`"],
      };
      handleOJSCell(newCell, cell.source.join(""), ["dot", "cell-code"]);
    } else if (cell.cell_type?.language === "ojs") {
      handleOJSCell(cell);
    } else {
      ls.push(`\n\`\`\`{${cell.cell_type.language}}`);
      ls.push(
        cell.source.map((s) => inlineInterpolation(s, errorVal)).join(""),
      );
      ls.push("```");
    }
  }

  if (selfContained) {
    const selfContainedPageResources = await makeSelfContainedResources(
      pageResources,
      docDir,
    );
    const resolver = JSON.stringify(
      Object.fromEntries(Array.from(selfContainedPageResources)),
    );
    scriptContents.unshift(
      `window._ojs.runtime.setLocalResolver(${resolver});`,
    );
  } else {
    for (const resource of uniqueResources(pageResources)) {
      resourceFiles.push(resource.filename);
    }
  }

  // Handle shiny input and output YAML declarations
  // deno-lint-ignore no-explicit-any
  const serverMetadata = options.format.metadata?.server as any;
  const normalizeMetadata = (key: string, def: string[]) => {
    if (!serverMetadata ||
      (serverMetadata["type"] !== "shiny") ||
      !serverMetadata[key]) {
      return def;
    }
    if (typeof serverMetadata[key] === "string") {
      return [serverMetadata[key]];
    } else {
      return serverMetadata[key];
    }
  };
  const shinyInputMetadata = normalizeMetadata("ojs-export", ["viewof"]);
  const shinyOutputMetadata = normalizeMetadata("ojs-import", []);
  const shinyInputs = new Set<string>();
  const shinyInputExcludes = new Set<string>();

  if (serverMetadata?.["ojs-exports"]) {
    throw new Error("Document metadata contains server.ojs-exports; did you mean 'ojs-export' instead?")
  }
  if (serverMetadata?.["ojs-imports"]) {
    throw new Error("Document metadata contains server.ojs-exports; did you mean 'ojs-export' instead?")
  }

  let importAllViews = false;
  let importEverything = false;

  for (const shinyInput of shinyInputMetadata) {
    if (shinyInput === "viewof") {
      importAllViews = true;
    } else if (shinyInput === "all") {
      importEverything = true;
    } else if (shinyInput.startsWith("~")) {
      shinyInputExcludes.add(shinyInput.slice(1));
    } else {
      shinyInputs.add(shinyInput);
    }
  }

  const resultSet = new Set<string>();
  if (importEverything) {
    for (const el of ojsViews) {
      resultSet.add(el);
    }
    for (const el of ojsIdentifiers) {
      resultSet.add(el);
    }
  }
  if (importAllViews) {
    for (const el of ojsViews) {
      resultSet.add(el);
    }
  }
  for (const el of shinyInputs) {
    resultSet.add(el);
  }
  for (const el of shinyInputExcludes) {
    resultSet.delete(el);
  }

  for (const el of resultSet) {
    moduleContents.push({
      methodName: "interpretQuiet",
      source: `shinyInput('${el}')`,
    });
  }
  
  for (const el of shinyOutputMetadata) {
    moduleContents.push({
      methodName: "interpretQuiet",
      source: `${el} = shinyOutput('${el}')`,
    });
  }

  // finish script by calling runtime's "done with new source" handler,
  scriptContents.push("window._ojs.runtime.interpretFromScriptTags();");

  // script to append
  const afterBody = [
    `<script type="ojs-module-contents">`,
    JSON.stringify({ contents: moduleContents }),
    `</script>`,
    `<script type="module">`,
    ...scriptContents,
    `</script>`,
  ]
    .join("\n");
  const includeAfterBodyFile = sessionTempFile();
  Deno.writeTextFileSync(includeAfterBodyFile, afterBody);

  // we need to inline esbuild-bundle.js rather than link to it in order
  // for ojs to work in non-webserver contexts. <script type="module"></script> runs into CORS restrictions

  const extras = resolveDependencies(
    {
      html: {
        [kDependencies]: [ojsFormatDependency(selfContained)],
      },
    },
    dirname(options.source),
    options.libDir,
  );

  const ojsBundleTempFiles = [];
  // FIXME is this the correct way to specify a resources path in quarto?
  if (selfContained) {
    const ojsBundleFilename = join(
      quartoConfig.sharePath(),
      "formats/html/ojs/esbuild-bundle.js",
      // "formats/html/ojs/ojs-bundle.js",
      // "formats/html/ojs/stdlib.js",
    );
    const ojsBundle = [
      `<script type="module">`,
      Deno.readTextFileSync(ojsBundleFilename),
      `</script>`,
    ];

    const filename = sessionTempFile();
    Deno.writeTextFileSync(filename, ojsBundle.join("\n"));
    ojsBundleTempFiles.push(filename);
  }

  // copy ojs dependencies and inject references to them into the head
  const includeInHeader = [
    ...(extras?.[kIncludeInHeader] || []),
    ...ojsBundleTempFiles,
  ];

  Deno.writeTextFileSync("/tmp/out.md", ls.join("\n"));
  
  return {
    markdown: ls.join("\n"),
    filters: [
      "ojs",
    ],
    includes: {
      [kIncludeInHeader]: includeInHeader,
      [kIncludeAfterBody]: [includeAfterBodyFile],
    },
    resourceFiles,
  };
}

export async function ojsExecuteResult(
  context: RenderContext,
  executeResult: ExecuteResult,
) {
  executeResult = ld.cloneDeep(executeResult);

  // evaluate ojs chunks
  const { markdown, includes, filters, resourceFiles } = await ojsCompile({
    source: context.target.source,
    format: context.format,
    markdown: executeResult.markdown,
    libDir: context.libDir,
    project: context.project,
  });

  // merge in results
  executeResult.markdown = markdown;
  if (includes) {
    executeResult.includes = mergeConfigs(
      includes,
      executeResult.includes || {},
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

function ojsFormatDependency(selfContained: boolean) {
  const ojsResource = (resource: string) =>
    formatResourcePath(
      "html",
      join("ojs", resource),
    );
  const ojsDependency = (
    resource: string,
    attribs?: Record<string, string>,
  ) => ({
    name: resource,
    path: ojsResource(resource),
    attribs,
  });

  // we potentially skip scripts here because we might need to force
  // them to be inline in case we are running in a file:/// context.
  const scripts = selfContained
    ? []
    : [
      ojsDependency("esbuild-bundle.js", { type: "module" })
      // ojsDependency("ojs-bundle.js", { type: "module" }),
      // ojsDependency("stdlib.js", { type: "module" })
      ];
  return {
    name: "quarto-ojs",
    stylesheets: [
      ojsDependency("quarto-ojs.css"),
    ],
    scripts,
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
