/*
 * compile.ts
 *
 * Copyright (C) 2021-2022 Posit Software, PBC
 */

import * as ld from "../../core/lodash.ts";
import { dirname, join, relative, resolve } from "path/mod.ts";
import { warning } from "log/mod.ts";

import { parseModule } from "observablehq/parser";

import { Format, kDependencies } from "../../config/types.ts";
import { MappedExecuteResult, PandocIncludes } from "../../execute/types.ts";
import {
  kEmbedResources,
  kIncludeAfterBody,
  kIncludeInHeader,
  kSelfContained,
} from "../../config/constants.ts";
import { RenderContext } from "../../command/render/types.ts";
import { ProjectContext } from "../../project/types.ts";

import {
  isJavascriptCompatible,
  isMarkdownOutput,
} from "../../config/format.ts";

import { resolveDependencies } from "../../command/render/pandoc-dependencies-html.ts";
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
  kCodeLineNumbers,
  kCodeOverflow,
  kEcho,
  kError,
  kEval,
  kInclude,
  kLayoutNcol,
  kLayoutNrow,
  kOutput,
} from "../../config/constants.ts";

import { asHtmlId } from "../../core/html.ts";
import { TempContext } from "../../core/temp.ts";
import { quartoConfig } from "../../core/quarto.ts";
import { mergeConfigs } from "../../core/config.ts";
import { formatResourcePath } from "../../core/resources.ts";
import { logError } from "../../core/log.ts";
import { breakQuartoMd, QuartoMdCell } from "../../core/lib/break-quarto-md.ts";

import { MappedString } from "../../core/mapped-text.ts";
import { languagesInMarkdown } from "../engine-shared.ts";

import {
  pandocBlock,
  pandocCode,
  pandocDiv,
  pandocRawStr,
} from "../../core/pandoc/codegen.ts";

import {
  EitherString,
  join as mappedJoin,
  mappedTrim,
} from "../../core/lib/mapped-text.ts";
import { getDivAttributes } from "../../core/handlers/base.ts";
import { pathWithForwardSlashes } from "../../core/path.ts";
import { executeInlineCodeHandlerMapped } from "../../core/execute-inline.ts";

export interface OjsCompileOptions {
  source: string;
  format: Format;
  markdown: MappedString;
  libDir: string;
  temp: TempContext;
  project?: ProjectContext;
  ojsBlockLineNumbers: number[];
}

export interface OjsCompileResult {
  markdown: MappedString;
  filters?: string[];
  includes?: PandocIncludes;
  resourceFiles?: string[];
}

interface SubfigureSpec {
  caption?: string;
}

const ojsHasOutputs = (parse: any) => {
  let hasOutputs = false;
  ojsSimpleWalker(parse, {
    Cell(node: any) {
      if (node.id === null) {
        hasOutputs = true;
      }
    },
  });
  return hasOutputs;
};

// TODO decide how source code is presented, we've lost this
// feature from the ojs-engine move
export async function ojsCompile(
  options: OjsCompileOptions,
): Promise<OjsCompileResult> {
  const { markdown, project, ojsBlockLineNumbers } = options;

  const output = await breakQuartoMd(markdown, true);

  // This is a pretty crude check, but
  // we can't actually make good use breakQuartoMd's output here
  // because the {r} and {python} cells have already been
  // executed by the engine.
  const hasOjsDefines = markdown.value.indexOf("ojs_define") !== -1;

  // if ojs-engine is explicitly `false` or it's an unsupported format,
  // do nothing
  if (
    !isJavascriptCompatible(options.format) ||
    options.format.metadata?.["ojs-engine"] === false
  ) {
    return { markdown: markdown };
  }

  const languages = languagesInMarkdown(markdown.value);
  // if ojs-engine is not explicitly `true` and we couldn't detect an ojs cell,
  // do nothing
  if (
    (options.format.metadata?.["ojs-engine"] !== true) &&
    !languages.has("ojs") &&
    !hasOjsDefines
  ) {
    return { markdown: markdown };
  }

  const projDir = project?.dir;
  const selfContained = options.format.pandoc?.[kSelfContained] ??
    options.format.pandoc?.[kEmbedResources] ?? false;
  const isHtmlMarkdown = isMarkdownOutput(options.format, [
    "gfm",
    "commonmark",
  ]);

  let ojsCellID = 0;
  let ojsBlockIndex = 0; // this is different from ojsCellID because of inline cells.
  const userIds: Set<string> = new Set();

  const scriptContents: string[] = [];

  const ojsRuntimeDir = resolve(
    dirname(options.source),
    options.libDir + "/ojs",
  );
  const docDir = dirname(options.source);
  const rootDir = projDir ?? "./";
  const runtimeToDoc = pathWithForwardSlashes(relative(ojsRuntimeDir, docDir));
  const runtimeToRoot = pathWithForwardSlashes(
    relative(ojsRuntimeDir, rootDir),
  );
  const docToRoot = pathWithForwardSlashes(relative(docDir, rootDir));
  // the check for file:// protocol has to be done in an inline script because
  // script links are not loaded in file:// protocol cases
  scriptContents.push(
    `if (window.location.protocol === "file:") { alert("The OJS runtime does not work with file:// URLs. Please use a web server to view this document."); }`,
  );
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
    source: string; // FIXME we want this to be the serialization output of a MappedString;
  }
  const moduleContents: ModuleCell[] = [];

  function interpret(jsSrc: MappedString, inline: boolean, lenient: boolean) {
    const inlineStr = inline ? "inline-" : "";
    const methodName = lenient ? "interpretLenient" : "interpret";
    moduleContents.push({
      methodName,
      cellName: `ojs-${inlineStr}cell-${ojsCellID}`,
      inline,

      // FIXME This here is the big problem now. We'd like to send
      // jsSrc as is,
      //
      // but moduleContents needs to be JSON-serializable in order for
      // the runtime to interpret it. But that gives problems with
      // respect to our ability to compute offsets etc.
      source: jsSrc.value,
    });
  }

  const ls: EitherString[] = [];
  const resourceFiles: string[] = [];
  const pageResources: ResourceDescription[] = [];
  const ojsViews = new Set<string>();
  const ojsIdentifiers = new Set<string>();

  for (const cell of output.cells) {
    const errorVal =
      (cell.options?.[kError] ?? options.format.execute?.[kError] ??
        false) as boolean;
    const handleOJSCell = async (
      cell: QuartoMdCell,
      mdClassList?: string[],
    ) => {
      const cellSrcStr = cell.source;
      const bumpOjsCellIdString = () => {
        ojsCellID += 1;
        return `ojs-cell-${ojsCellID}`;
      };
      const ojsId = bumpOjsCellIdString();
      console.log({ ojsId });
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
        } else if (
          cell.options?.[kCellFigCap] || cell.options?.[kCellFigSubCap] ||
          cell.options?.[kCellLstCap]
        ) {
          return chooseId(`fig-${ojsId}`);
        } else {
          return undefined;
        }
      };
      const userId = userCellId();
      const attrs = [];

      const hasFigureSubCaptions = () => {
        // FIXME figure out runtime type validation. This should check
        // if fig-subcap is an array of strings.
        //
        // WAITING for YAML schemas + validation
        return cell.options?.[kCellFigSubCap];
      };

      interface SourceInfo {
        start: number;
        end: number;
        cellType: string;
      }
      interface ParsedCellInfo {
        info: SourceInfo[];
      }

      const cellStartingLoc = ojsBlockLineNumbers[ojsBlockIndex++] || 0;
      if (cellStartingLoc === 0) {
        warning(
          "OJS block count mismatch. Line number reporting is likely to be wrong",
        );
      }

      // deno-lint-ignore no-explicit-any
      const handleError = (err: any, cellSrc: MappedString) => {
        const div = pandocDiv({
          classes: ["quarto-ojs-syntax-error"],
        });
        const msg = String(err).split("\n")[0].trim().replace(
          / *\(\d+:\d+\)$/,
          "",
        );
        ojsParseError(err, cellSrc);

        const preDiv = pandocBlock("````")({
          classes: ["numberLines", "java"],
          attrs: [
            `startFrom="${cellStartingLoc - 1}"`,
            `syntax-error-position="${err.pos}"`,
            `source-offset="${cell.sourceOffset}"`,
          ],
        });
        preDiv.push(pandocRawStr(cell.sourceVerbatim.value.trim()));
        div.push(preDiv);
        const errMsgDiv = pandocDiv({
          classes: ["cell-output", "cell-output-error"],
        });
        const calloutDiv = pandocDiv({
          classes: ["callout-important"],
        });
        const [_heading, fullMsg] = msg.split(": ");
        calloutDiv.push(
          pandocRawStr(
            `#### OJS Syntax Error (line ${
              err.loc.line +
              cellStartingLoc + cell.sourceStartLine -
              1
            }, column ${err.loc.column + 1})`,
          ),
        );
        calloutDiv.push(pandocRawStr(`${fullMsg}`));
        errMsgDiv.push(calloutDiv);
        div.push(errMsgDiv);
        div.emit(ls);
      };

      let nCells = 0;
      const parsedCells: ParsedCellInfo[] = [];
      let hasOutputs = true;

      try {
        const parse = parseModule(cellSrcStr.value);
        hasOutputs = ojsHasOutputs(parse);
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
            if (
              node.id === null &&
              node.body.type !== "ImportDeclaration"
            ) {
              info.push({
                start: node.start,
                end: node.end,
                cellType: "expression",
              });
              flushSeqSrc();
            } else {
              info.push({
                start: node.start,
                end: node.end,
                cellType: "declaration",
              });
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

      pageResources.push(
        ...(await extractResourceDescriptionsFromOJSChunk(
          cellSrcStr,
          dirname(options.source),
          projDir,
        )),
      );

      const hasManyRowsCols = () => {
        // FIXME figure out runtime type validation. This should check
        // if ncol and nrow are positive integers
        //
        // WAITING for YAML schemas + validation
        const cols = cell.options?.[kLayoutNcol];
        const rows = cell.options?.[kLayoutNrow];
        return (Number(cols) && (Number(cols) > 1)) ||
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

      let outputVal: any = cell.options?.[kOutput] ??
        options.format.execute[kOutput];
      // if (
      //   options.format.identifier["base-format"] == "dashboard" &&
      //   !hasOutputs
      // ) {
      //   outputVal = false;
      // }
      outputVal = outputVal ?? true;
      if (outputVal === "all") {
        attrs.push(`output="all"`);
      }
      const {
        classes,
        attrs: otherAttrs,
      } = getDivAttributes(cell.options || {}); // TODO this import is weird but eventually OJS will be a handler
      attrs.push(...otherAttrs);

      const evalVal = cell.options?.[kEval] ?? options.format.execute[kEval] ??
        true;
      const echoVal = cell.options?.[kEcho] ?? options.format.execute[kEcho] ??
        true;

      const ojsCellClasses = ["cell"];
      if (!outputVal) {
        ojsCellClasses.push("hidden");
      }

      const div = pandocDiv({
        id: idPlacement() === "outer" ? userId : undefined,
        classes: [
          ...ojsCellClasses,
          ...classes,
        ],
        attrs,
      });

      const includeVal = cell.options?.[kInclude] ??
        options.format.execute[kInclude] ?? true;

      const srcClasses = mdClassList ?? ["js", "cell-code"];
      const srcAttrs = [];

      // the only effect of echoVal in OJS blocks
      // is to hide the div. We need source always to pinpoint
      // errors in source in case of runtime errors.
      //
      // FIXME This is
      // potentially wrong in the presence of !includeVal
      if (!echoVal) {
        srcClasses.push("hidden");
      }

      if (cell.options?.[kCodeOverflow] === "wrap") {
        srcClasses.push("code-overflow-wrap");
      } else if (cell.options?.[kCodeOverflow] === "scroll") {
        srcClasses.push("code-overflow-scroll");
      }

      // options.format.render?.[kCodeFold] appears to use "none"
      // for "not set", so we interpret "none" as undefined
      if (
        asUndefined(options.format.render?.[kCodeFold], "none") ??
          cell.options?.[kCodeFold]
      ) {
        srcAttrs.push(`${kCodeFold}="${cell.options?.[kCodeFold]}"`);
      }

      if (cell.options?.[kCodeLineNumbers]) {
        srcAttrs.push(
          `${kCodeLineNumbers}="${cell.options?.[kCodeLineNumbers]}"`,
        );
      }

      const srcConfig = {
        classes: srcClasses.slice(),
        attrs: srcAttrs.slice(),
      };

      // only emit interpret if eval is true
      if (evalVal) {
        interpret(cell.source, false, errorVal);
      }

      // handle output of computation
      const outputCellClasses = ["cell-output", "cell-output-display"];
      if (!outputVal || !includeVal) {
        outputCellClasses.push("hidden");
      }

      if (echoVal === "fenced") {
        const ourAttrs = srcConfig.attrs.slice();
        // we replace js with java so that we "fool" pandoc by having it
        // not recognize triple backticks
        const ourClasses = srcConfig.classes.filter((d) => d !== "js");
        ourClasses.push("java");
        ourAttrs.push(
          `startFrom="${cellStartingLoc - 1}"`,
          `source-offset="${cell.sourceOffset}"`,
        );
        const srcDiv = pandocBlock("````")({
          classes: ourClasses,
          attrs: ourAttrs,
        });
        srcDiv.push(pandocRawStr(cell.sourceVerbatim.value.trim()));
        div.push(srcDiv);
      }

      // if "echo: fenced", then we've already printed the source
      // and it's neatly localized: don't repeat it
      //
      // in addition, if we're emitting html-friendly markdown
      // (as opposed to "html", which is what we do most of the time),
      // then pandoc will clobber our classes and our runtime error
      // reporting things will break anyway. So just don't emit
      // the source in that case.
      const shouldEmitSource = echoVal !== "fenced" &&
        !(echoVal === false && isHtmlMarkdown);

      const makeSubFigures = (specs: SubfigureSpec[]) => {
        let subfigIx = 1;
        const cellInfo = ([] as SourceInfo[]).concat(
          ...(parsedCells.map((n) => n.info)),
        );
        for (const spec of specs) {
          const outputDiv = pandocDiv({
            classes: outputCellClasses,
          });
          const outputInnerDiv = pandocDiv({
            id: userId && `${userId}-${subfigIx}`,
          });
          const innerInfo = parsedCells[subfigIx - 1].info;
          const ojsDiv = pandocDiv({
            id: `${ojsId}-${subfigIx}`,
            attrs: [`nodetype="${cellInfo[subfigIx - 1].cellType}"`],
          });

          if (
            shouldEmitSource &&
            innerInfo.length > 0 && srcConfig !== undefined
          ) {
            const ourAttrs = srcConfig.attrs.slice();
            // compute offset from cell start to div start
            const linesSkipped =
              cellSrcStr.value.substring(0, innerInfo[0].start).split("\n")
                .length;

            ourAttrs.push(
              `startFrom="${
                cellStartingLoc + cell.sourceStartLine - 1 +
                linesSkipped
              }"`,
            );
            ourAttrs.push(`source-offset="-${innerInfo[0].start}"`);
            const srcDiv = pandocCode({
              attrs: ourAttrs,
              classes: srcConfig.classes,
            });
            srcDiv.push(pandocRawStr(
              cellSrcStr.value.substring(
                innerInfo[0].start,
                innerInfo[innerInfo.length - 1].end,
              ).trim(),
            ));
            div.push(srcDiv);
          }
          subfigIx++;
          outputDiv.push(outputInnerDiv);
          outputInnerDiv.push(ojsDiv);
          if (spec.caption) {
            // FIXME does this also need figcaption?
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
        let subCap = (cell.options?.[kCellFigSubCap]) as string[] | true;
        if (subCap === true) {
          subCap = [""];
        }
        if (!Array.isArray(subCap)) {
          subCap = [subCap];
        }
        if (
          hasManyRowsCols() &&
          (subCap as string[]).length !==
            (nRow() * nCol())
        ) {
          throw new Error(
            "Cannot have subcaptions and multi-row/col layout with mismatched number of cells",
          );
        }
        const specs = (subCap as string[]).map(
          (caption) => ({ caption }),
        );
        makeSubFigures(specs);
        if (cell.options?.[kCellFigCap]) {
          div.push(pandocRawStr(cell.options[kCellFigCap] as string));
        }
      } else {
        // FIXME: this should include better file and LOC information!
        if (parsedCells.length === 0) {
          throw new Error(
            `Fatal: OJS cell starting on line ${cellStartingLoc} is empty. OJS cells require at least one declaration.`,
          );
        }
        const innerInfo = parsedCells[0].info;
        if (innerInfo.length > 0 && srcConfig !== undefined) {
          const ourAttrs = srcConfig.attrs.slice();
          // compute offset from cell start to div start
          ourAttrs.push(
            `startFrom="${cellStartingLoc + cell.sourceStartLine - 1}"`,
          );
          ourAttrs.push(`source-offset="0"`);
          if (shouldEmitSource) {
            const srcDiv = pandocCode({
              attrs: ourAttrs,
              classes: srcConfig.classes,
            });
            srcDiv.push(
              pandocRawStr(mappedTrim(cellSrcStr)),
            );
            div.push(srcDiv);
          }
        }
        const outputDiv = pandocDiv({
          id: idPlacement() === "inner" ? userId : undefined,
          classes: outputCellClasses,
        });
        div.push(outputDiv);
        outputDiv.push(pandocDiv({
          id: ojsId,
          attrs: [`nodetype="${innerInfo[0].cellType}"`],
        }));
        if (cell.options?.[kCellFigCap]) {
          outputDiv.push(pandocRawStr(cell.options[kCellFigCap] as string));
        }
      }

      div.emit(ls);
    };

    if (
      cell.cell_type === "raw"
    ) {
      // The lua filter is in charge of this, we're a NOP.
      ls.push(cell.sourceVerbatim);
    } else if (cell.cell_type === "markdown") {
      // Convert to native OJS inline expression syntax then delegate to lua filter
      // TODO: for now we just do this to detect use of `{ojs} x` syntax and then
      // throw an error indicating its unsupported. This code needs to be updated
      // to handle mapped strings correctly.
      const markdown = executeInlineCodeHandlerMapped(
        "ojs",
        (exec) => "${" + exec + "}",
      )(cell.sourceVerbatim);

      ls.push(markdown);
    } else if (cell.cell_type?.language === "ojs") {
      await handleOJSCell(cell);
    } else {
      ls.push(cell.sourceVerbatim);
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
    if (
      !serverMetadata ||
      (serverMetadata["type"] !== "shiny") ||
      !serverMetadata[key]
    ) {
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
    throw new Error(
      "Document metadata contains server.ojs-exports; did you mean 'ojs-export' instead?",
    );
  }
  if (serverMetadata?.["ojs-imports"]) {
    throw new Error(
      "Document metadata contains server.ojs-imports; did you mean 'ojs-import' instead?",
    );
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
  const includeAfterBodyFile = options.temp.createFile();
  Deno.writeTextFileSync(includeAfterBodyFile, afterBody);

  const extras = resolveDependencies(
    {
      html: {
        [kDependencies]: [ojsFormatDependency(selfContained)],
      },
    },
    dirname(options.source),
    options.libDir,
    options.temp,
    project,
  );

  const ojsBundleTempFiles = [];
  // FIXME is this the correct way to specify a resources path in quarto?
  if (selfContained) {
    // we need to inline quarto-ojs-runtime.js rather than link to it in order
    // for ojs to work in non-webserver contexts. <script type="module" src=...></script> runs into CORS restrictions
    const ojsBundleFilename = join(
      quartoConfig.sharePath(),
      "formats/html/ojs/quarto-ojs-runtime.js",
    );
    const ojsBundle = [
      `<script type="module">`,
      Deno.readTextFileSync(ojsBundleFilename),
      `</script>`,
    ];

    const filename = options.temp.createFile();
    Deno.writeTextFileSync(filename, ojsBundle.join("\n"));
    ojsBundleTempFiles.push(filename);
  }

  // copy ojs dependencies and inject references to them into the head
  const includeInHeader = [
    ...(extras?.[kIncludeInHeader] || []),
    ...ojsBundleTempFiles,
  ];

  return {
    markdown: mappedJoin(ls, ""),
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
  executeResult: MappedExecuteResult,
  ojsBlockLineNumbers: number[],
) {
  executeResult = ld.cloneDeep(executeResult);

  // evaluate ojs chunks
  const { markdown, includes, filters, resourceFiles } = await ojsCompile({
    source: context.target.source,
    format: context.format,
    markdown: executeResult.markdown,
    libDir: context.libDir,
    project: context.project,
    temp: context.options.services.temp,
    ojsBlockLineNumbers,
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
  const scripts = selfContained ? [] : [
    ojsDependency("quarto-ojs-runtime.js", { type: "module" }),
  ];
  return {
    name: "quarto-ojs",
    stylesheets: [
      ojsDependency("quarto-ojs.css"),
    ],
    scripts,
  };
}
