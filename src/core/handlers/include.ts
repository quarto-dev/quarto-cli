/*
* include.ts
*
* Copyright (C) 2022 Posit Software, PBC
*
*/

import { LanguageCellHandlerContext, LanguageHandler } from "./types.ts";
import { baseHandler, install, languages } from "./base.ts";
import {
  asMappedString,
  EitherString,
  mappedConcat,
  MappedString,
  mappedString,
} from "../lib/mapped-text.ts";

import { rangedLines } from "../lib/ranged-text.ts";
import { isBlockShortcode } from "../lib/parse-shortcode.ts";
import { DirectiveCell } from "../lib/break-quarto-md-types.ts";
import {
  jupyterAssets,
  jupyterFromFile,
  jupyterToMarkdown,
} from "../jupyter/jupyter.ts";

import { dirname, extname } from "path/mod.ts";
import {
  kFigDpi,
  kFigFormat,
  kFigPos,
  kKeepHidden,
} from "../../config/constants.ts";
import {
  isHtmlCompatible,
  isIpynbOutput,
  isLatexOutput,
  isMarkdownOutput,
  isPresentationOutput,
} from "../../config/format.ts";
import { resourcePath } from "../resources.ts";
import { resolveParams } from "../../command/render/flags.ts";
import { RenderFlags } from "../../command/render/types.ts";
import { callbackify } from "https://deno.land/std@0.153.0/node/util.ts";
import { translationsForLang } from "../language.ts";
import { JupyterCell } from "../jupyter/types.ts";

const includeHandler: LanguageHandler = {
  ...baseHandler,

  languageName: "include",

  type: "directive",
  stage: "pre-engine",

  async directive(
    handlerContext: LanguageCellHandlerContext,
    directive: DirectiveCell,
  ): Promise<MappedString> {
    const source = handlerContext.options.context.target.source;
    const retrievedFiles: string[] = [source];

    const textFragments: EitherString[] = [];

    const retrieveInclude = async (filename: string) => {
      const path = handlerContext.resolvePath(filename);

      if (retrievedFiles.indexOf(path) !== -1) {
        throw new Error(
          `Include directive found circular include of file ${filename}.`,
        );
      }

      // If the path is a notebook path, then process it separately.
      const parseNotebookPath = (path: string) => {
        if (path.includes("#")) {
          const pathParts = path.split("#");
          const filePath = pathParts[0];
          const cellId = pathParts.slice(1);
          return {
            path: filePath,
            cellId,
          };
        } else {
          const ext = extname(path);
          if (ext === ".ipynb") {
            return {
              path,
            };
          } else {
            return undefined;
          }
        }
      };

      const notebookPath = parseNotebookPath(path);
      if (notebookPath) {
        const nb = jupyterFromFile(notebookPath.path);
        const assets = jupyterAssets(
          source,
          handlerContext.options.context.format.pandoc.to,
        );

        const cells: JupyterCell[] = [];

        // filter the notebook
        if (notebookPath.cellId) {
          for (const cell of nb.cells) {
            const hasId = cell.id
              ? notebookPath.cellId.includes(cell.id)
              : false;
            if (hasId) {
              cells.push(cell);
            } else {
              const hasTag = cell.metadata.tags
                ? cell.metadata.tags.find((tag) =>
                  notebookPath.cellId.includes(tag)
                ) !== undefined
                : false;
              if (hasTag) {
                cells.push(cell);
              }
            }
          }
        }
        nb.cells = cells.map((cell) => {
          cell.metadata = {
            ...cell.metadata,
            "echo": false,
          };
          return cell;
        });

        const options = handlerContext.options;
        const context = options.context;
        const flags: RenderFlags = {};

        const executeOptions = {
          target: context.target,
          resourceDir: resourcePath(),
          tempDir: context.options.services.temp.createDir(),
          dependencies: true,
          libDir: context.libDir,
          format: context.format,
          projectDir: context.project?.dir,
          cwd: flags.executeDir ||
            dirname(Deno.realPathSync(context.target.source)),
          params: resolveParams(flags.params, flags.paramsFile),
          quiet: flags.quiet,
          previewServer: context.options.previewServer,
          handledLanguages: languages(),
        };
        const result = await jupyterToMarkdown(
          nb,
          {
            executeOptions,
            language: nb.metadata.kernelspec.language.toLowerCase(),
            assets,
            execute: options.format.execute,
            keepHidden: options.format.render[kKeepHidden],
            toHtml: isHtmlCompatible(options.format),
            toLatex: isLatexOutput(options.format.pandoc),
            toMarkdown: isMarkdownOutput(options.format.pandoc),
            toIpynb: isIpynbOutput(options.format.pandoc),
            toPresentation: isPresentationOutput(options.format.pandoc),
            figFormat: options.format.execute[kFigFormat],
            figDpi: options.format.execute[kFigDpi],
            figPos: options.format.render[kFigPos],
          },
        );
        if (result) {
          textFragments.push(result.markdown);
        }
      } else {
        let includeSrc;
        try {
          includeSrc = asMappedString(
            Deno.readTextFileSync(path),
            path,
          );
        } catch (_e) {
          const errMsg: string[] = [`Include directive failed.`];
          errMsg.push(...retrievedFiles.map((s) => `  in file ${s}, `));
          errMsg.push(
            `  could not find file ${path
              //            relative(handlerContext.options.context.target.source, path)
            }.`,
          );
          throw new Error(errMsg.join("\n"));
        }

        retrievedFiles.push(filename);

        let rangeStart = 0;
        for (const { substring, range } of rangedLines(includeSrc.value)) {
          const m = isBlockShortcode(substring);
          if (m && m.name.toLocaleLowerCase() === "include") {
            textFragments.push(
              mappedString(includeSrc, [{
                start: rangeStart,
                end: range.start,
              }]),
            );
            rangeStart = range.end;
            const params = m.params;
            if (params.length === 0) {
              throw new Error("Include directive needs file parameter");
            }

            await retrieveInclude(params[0]);
          }
        }
        if (rangeStart !== includeSrc.value.length) {
          textFragments.push(
            mappedString(includeSrc, [{
              start: rangeStart,
              end: includeSrc.value.length,
            }]),
          );
        }
        textFragments.push(includeSrc.value.endsWith("\n") ? "\n" : "\n\n");
      }

      retrievedFiles.pop();
    };

    const param = directive.shortcode.params[0];
    if (!param) {
      throw new Error("Include directive needs filename as a parameter");
    }

    await retrieveInclude(param);

    return Promise.resolve(mappedConcat(textFragments));
  },
};

install(includeHandler);
