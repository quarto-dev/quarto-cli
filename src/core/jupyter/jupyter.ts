/*
 * jupyter.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

// deno-lint-ignore-file camelcase

import { ensureDirSync, walkSync } from "../../deno_ral/fs.ts";
import { dirname, extname, join, relative } from "../../deno_ral/path.ts";
import * as colors from "fmt/colors";
import { decodeBase64 as base64decode } from "encoding/base64";
import { stringify } from "../yaml.ts";
import { partitionCellOptions } from "../lib/partition-cell-options.ts";
import * as ld from "../lodash.ts";

import { shortUuid } from "../uuid.ts";

import {
  extensionForMimeImageType,
  kApplicationJavascript,
  kApplicationRtf,
  kImagePng,
  kImageSvg,
  kRestructuredText,
  kTextHtml,
  kTextLatex,
  kTextPlain,
} from "../mime.ts";

import PngImage from "../png.ts";

import {
  echoFenced,
  hideCell,
  hideCode,
  hideOutput,
  hideWarnings,
  includeCell,
  includeCode,
  includeOutput,
  includeWarnings,
} from "./tags.ts";
import {
  cellLabel,
  cellLabelValidator,
  resolveCaptions,
  shouldLabelCellContainer,
  shouldLabelOutputContainer,
} from "./labels.ts";
import {
  displayDataIsHtml,
  displayDataIsImage,
  displayDataIsJavascript,
  displayDataIsJson,
  displayDataIsLatex,
  displayDataIsMarkdown,
  displayDataIsTextPlain,
  displayDataMimeType,
  displayDataWithMarkdownMath,
  isCaptionableData,
  isDisplayData,
} from "./display-data.ts";
import { extractJupyterWidgetDependencies } from "./widgets.ts";
import { removeAndPreserveHtml } from "./preserve.ts";
import { pandocAsciify, pandocAutoIdentifier } from "../pandoc/pandoc-id.ts";
import { Metadata } from "../../config/types.ts";
import {
  kCapLoc,
  kCellAutoscroll,
  kCellClasses,
  kCellColab,
  kCellColabType,
  kCellColbOutputId,
  kCellCollapsed,
  kCellColumn,
  kCellDeletable,
  kCellFigAlign,
  kCellFigAlt,
  kCellFigCap,
  kCellFigColumn,
  kCellFigEnv,
  kCellFigLink,
  kCellFigPos,
  kCellFigScap,
  kCellFigSubCap,
  kCellFormat,
  kCellHeight,
  kCellId,
  kCellLabel,
  kCellLanguage,
  kCellLinesToNext,
  kCellLstCap,
  kCellLstLabel,
  kCellMdIndent,
  kCellName,
  kCellOutHeight,
  kCellOutWidth,
  kCellPanel,
  kCellRawMimeType,
  kCellSlideshow,
  kCellSlideshowSlideType,
  kCellTblColumn,
  kCellWidth,
  kCodeFold,
  kCodeLineNumbers,
  kCodeOverflow,
  kCodeSummary,
  kEcho,
  kError,
  kEval,
  kFigCapLoc,
  kHtmlTableProcessing,
  kInclude,
  kLayout,
  kLayoutAlign,
  kLayoutNcol,
  kLayoutNrow,
  kLayoutVAlign,
  kOutput,
  kTblCap,
  kTblCapLoc,
  kTblColwidths,
  kWarning,
} from "../../config/constants.ts";
import {
  isJupyterKernelspec,
  jupyterDefaultPythonKernelspec,
  jupyterKernelspec,
  jupyterKernelspecForLanguage,
  jupyterKernelspecs,
} from "./kernels.ts";
import {
  JupyterCell,
  JupyterCellOutput,
  JupyterCellWithOptions,
  JupyterKernelspec,
  JupyterNotebook,
  JupyterOutput,
  JupyterOutputDisplayData,
  JupyterOutputFigureOptions,
  JupyterOutputStream,
  JupyterToMarkdownOptions,
  JupyterToMarkdownResult,
} from "./types.ts";
import { figuresDir, inputFilesDir } from "../render.ts";
import { lines, trimEmptyLines } from "../lib/text.ts";
import { partitionYamlFrontMatter, readYamlFromMarkdown } from "../yaml.ts";
import { languagesInMarkdown } from "../../execute/engine-shared.ts";
import {
  normalizePath,
  pathWithForwardSlashes,
  removeIfEmptyDir,
} from "../path.ts";
import { convertToHtmlSpans, hasAnsiEscapeCodes } from "../ansi-colors.ts";
import { kProjectType, ProjectContext } from "../../project/types.ts";
import { mergeConfigs } from "../config.ts";
import { encodeBase64 } from "encoding/base64";
import {
  isHtmlOutput,
  isIpynbOutput,
  isJatsOutput,
} from "../../config/format.ts";
import {
  bookFixups,
  fixupJupyterNotebook,
  minimalFixups,
} from "./jupyter-fixups.ts";
import {
  resolveUserExpressions,
  userExpressionsFromCell,
} from "./jupyter-inline.ts";
import {
  jupyterCellSrcAsLines,
  jupyterCellSrcAsStr,
} from "./jupyter-shared.ts";
import { error } from "../../deno_ral/log.ts";
import { valid } from "semver/mod.ts";

export const kQuartoMimeType = "quarto_mimetype";
export const kQuartoOutputOrder = "quarto_order";
export const kQuartoOutputDisplay = "quarto_display";

export const kJupyterNotebookExtensions = [
  ".ipynb",
];

export function isJupyterNotebook(file: string) {
  return kJupyterNotebookExtensions.includes(extname(file).toLowerCase());
}

// option keys we handle internally so should not forward into generated markdown
export const kJupyterCellInternalOptionKeys = [
  kEval,
  kEcho,
  kWarning,
  kError,
  kOutput,
  kInclude,
  kCellLabel,
  kCellClasses,
  kCellPanel,
  kCellColumn,
  kCellFigCap,
  kCellFigSubCap,
  kCellFigScap,
  kFigCapLoc,
  kTblCapLoc,
  kCapLoc,
  kCellFigColumn,
  kCellTblColumn,
  kCellFigLink,
  kCellFigAlign,
  kCellFigAlt,
  kCellFigEnv,
  kCellFigPos,
  kCellLstLabel,
  kCellLstCap,
  kCellOutWidth,
  kCellOutHeight,
  kCellMdIndent,
  kCodeFold,
  kCodeLineNumbers,
  kCodeSummary,
  kCodeOverflow,
  kHtmlTableProcessing,
];

export const kJupyterCellOptionKeys = kJupyterCellInternalOptionKeys.concat([
  kLayoutAlign,
  kLayoutVAlign,
  kLayoutNcol,
  kLayoutNrow,
  kLayout,
  kTblCap,
  kTblColwidths,
]);

export const kJupyterCellStandardMetadataKeys = [
  kCellCollapsed,
  kCellAutoscroll,
  kCellDeletable,
  kCellFormat,
  kCellName,
];

export const kJupyterCellThirdPartyMetadataKeys = [
  // colab
  kCellId,
  kCellColab,
  kCellColabType,
  kCellColbOutputId,

  // jupytext
  kCellLinesToNext,

  // nbdev
  kCellLanguage,
];

export interface JupyterOutputExecuteResult extends JupyterOutputDisplayData {
  execution_count: number;
}

export interface JupyterOutputError extends JupyterOutput {
  ename: string;
  evalue: string;
  traceback: string[];
}

const countTicks = (code: string[]) => {
  // FIXME do we need trim() here?
  const countLeadingTicks = (s: string) => {
    // count leading ticks using regexps
    const m = s.match(/^\s*`+/);
    if (m) {
      return m[0].length;
    } else {
      return 0;
    }
  };
  return Math.max(0, ...code.map((s) => countLeadingTicks(s)));
};

const ticksForCode = (code: string[]) => {
  const n = Math.max(3, countTicks(code) + 1);
  return "`".repeat(n);
};

export async function quartoMdToJupyter(
  markdown: string,
  includeIds: boolean,
  project?: ProjectContext,
): Promise<JupyterNotebook> {
  const [kernelspec, metadata] = await jupyterKernelspecFromMarkdown(
    markdown,
    project,
  );

  // notebook to return
  const nb: JupyterNotebook = {
    cells: [],
    metadata: {
      kernelspec,
      ...metadata,
    },
    nbformat: 4,
    nbformat_minor: includeIds ? 5 : 4,
  };

  // regexes
  const yamlRegEx = /^---\s*$/;
  /^\s*```+\s*\{([a-zA-Z0-9_]+)( *[ ,].*)?\}\s*$/;
  const startCodeCellRegEx = new RegExp(
    "^(\\s*)(```+)\\s*\\{" + kernelspec.language.toLowerCase() +
      "( *[ ,].*)?\\}\\s*$",
  );
  const startCodeRegEx = /^(\s*)```/;
  const endCodeRegEx = (indent = "", backtickCount = 0) => {
    return new RegExp("^" + indent + "`".repeat(backtickCount) + "\\s*$");
  };

  // read the file into lines
  const inputContent = markdown;

  // line buffer & code indent
  let codeIndent = "";
  const lineBuffer: string[] = [];
  const flushLineBuffer = (
    cell_type: "markdown" | "code" | "raw",
    frontMatter?: boolean,
  ) => {
    if (lineBuffer.length) {
      if (lineBuffer[0] === "") {
        lineBuffer.splice(0, 1);
      }
      if (lineBuffer[lineBuffer.length - 1] === "") {
        lineBuffer.splice(lineBuffer.length - 1, 1);
      }
      // only use codeIndent for code cells
      if (cell_type !== "code") {
        codeIndent = "";
      }
      const cell: JupyterCell = {
        cell_type,
        metadata: codeIndent.length > 0 ? { [kCellMdIndent]: codeIndent } : {},
        source: lineBuffer.map((line, index) => {
          if (codeIndent.length > 0) {
            line = line.replace(codeIndent, "");
          }
          return line + (index < (lineBuffer.length - 1) ? "\n" : "");
        }),
      };
      if (includeIds) {
        cell.id = shortUuid();
      }
      if (cell_type === "raw" && frontMatter) {
        // delete 'jupyter' metadata since we've already transferred it
        const yaml = readYamlFromMarkdown(jupyterCellSrcAsStr(cell));
        if (yaml.jupyter) {
          delete yaml.jupyter;
          // write the cell only if there is metadata to write
          if (Object.keys(yaml).length > 0) {
            const yamlFrontMatter = trimEmptyLines(lines(stringify(yaml, {
              indent: 2,
              lineWidth: -1,
              sortKeys: false,
              skipInvalid: true,
            })));
            cell.source = [
              "---\n",
              ...(yamlFrontMatter.map((line) => line + "\n")),
              "---",
            ];
          } else {
            cell.source = [];
          }
        }
      } else if (cell_type === "code") {
        // see if there is embedded metadata we should forward into the cell metadata
        const cellSrcLines = typeof cell.source === "string"
          ? lines(cell.source)
          : cell.source;
        const { yaml, source } = partitionCellOptions(
          kernelspec.language.toLowerCase(),
          cellSrcLines,
        );
        if (yaml && !Array.isArray(yaml) && typeof yaml === "object") {
          // use label as id if necessary
          if (includeIds && yaml[kCellLabel] && !yaml[kCellId]) {
            yaml[kCellId] = jupyterAutoIdentifier(String(yaml[kCellLabel]));
          }

          const yamlKeys = Object.keys(yaml);
          yamlKeys.forEach((key) => {
            if (key === kCellId) {
              if (includeIds) {
                cell.id = String(yaml[key]);
              }
              delete yaml[key];
            } else {
              if (!kJupyterCellOptionKeys.includes(key)) {
                cell.metadata[key] = yaml[key];
                delete yaml[key];
              }
            }
          });

          // if we hit at least one we need to re-write the source
          if (Object.keys(yaml).length < yamlKeys.length) {
            const yamlOutput = jupyterCellOptionsAsComment(
              kernelspec.language.toLowerCase(),
              yaml,
            );
            cell.source = yamlOutput.concat(source);
          }
        }

        // reset outputs and execution_count
        cell.execution_count = null;
        cell.outputs = [];
      }

      // if the source is empty then don't add it
      const cellSrcLines = typeof cell.source === "string"
        ? lines(cell.source)
        : cell.source;
      cell.source = trimEmptyLines(cellSrcLines);
      if (cell.source.length > 0) {
        nb.cells.push(cell);
      }

      lineBuffer.splice(0, lineBuffer.length);
    }
  };

  // loop through lines and create cells based on state transitions
  let parsedFrontMatter = false,
    inYaml = false,
    inCodeCell = false,
    inCode = false,
    backtickCount = 0;
  let currentLine = 0;
  const contentLines = lines(inputContent);
  for (currentLine = 0; currentLine < contentLines.length; ++currentLine) {
    const line = contentLines[currentLine];
    // yaml front matter
    if (
      yamlRegEx.test(line) && !inCodeCell && !inCode &&
      contentLines[currentLine + 1]?.trim() !== "" // https://github.com/quarto-dev/quarto-cli/issues/8998
    ) {
      if (inYaml) {
        lineBuffer.push(line);
        flushLineBuffer("raw", !parsedFrontMatter);
        parsedFrontMatter = true;
        inYaml = false;
      } else {
        flushLineBuffer("markdown");
        lineBuffer.push(line);
        inYaml = true;
      }
    } // begin code cell: ^```python
    else if (!inCodeCell && startCodeCellRegEx.test(line)) {
      flushLineBuffer("markdown");
      inCodeCell = true;
      codeIndent = line.match(startCodeCellRegEx)![1];
      backtickCount = line.match(startCodeCellRegEx)![2].length;

      // end code block: ^``` (tolerate trailing ws)
    } else if (
      inCodeCell && endCodeRegEx(codeIndent, backtickCount).test(line)
    ) {
      // in a code cell, flush it
      if (inCodeCell) {
        inCodeCell = false;
        flushLineBuffer("code");
        codeIndent = "";

        // otherwise this flips the state of in-code
      } else {
        inCode = !inCode;
        codeIndent = "";
        lineBuffer.push(line);
      }

      // begin code block: ^```
    } else if (!inCodeCell && startCodeRegEx.test(line)) {
      codeIndent = line.match(startCodeRegEx)![1];
      inCode = true;
      lineBuffer.push(line);
    } else {
      lineBuffer.push(line);
    }
  }

  // if there is still a line buffer then make it a markdown cell
  flushLineBuffer("markdown");
  return nb;
}

export async function jupyterKernelspecFromMarkdown(
  markdown: string,
  project?: ProjectContext,
): Promise<[JupyterKernelspec, Metadata]> {
  const config = project?.config;
  const yaml = config
    ? mergeConfigs(config, readYamlFromMarkdown(markdown))
    : readYamlFromMarkdown(markdown);
  const yamlJupyter = yaml.jupyter;

  // if there is no yaml.jupyter then detect the file's language(s) and
  // find a kernelspec that supports this language
  if (!yamlJupyter) {
    const languages = languagesInMarkdown(markdown);
    languages.add("python"); // python as a default/failsafe
    for (const language of languages) {
      const kernelspec = await jupyterKernelspecForLanguage(language);
      if (kernelspec) {
        return [kernelspec, {}];
      }
    }
    const kernelspecs = await jupyterKernelspecs();
    return Promise.reject(
      new Error(
        `No kernel found for any language checked (${
          Array.from(languages).join(", ")
        }) in any of the kernelspecs checked (${
          Array.from(kernelspecs.values()).map((k) => k.name).join(", ")
        }).`,
      ),
    );
  } else if (typeof yamlJupyter === "string") {
    const kernel = yamlJupyter;
    const kernelspec = await jupyterKernelspec(kernel);
    if (kernelspec) {
      return [kernelspec, {}];
    } else {
      return Promise.reject(
        new Error(
          `Jupyter kernel '${kernel}' not found. Known kernels: ${
            Array.from((await jupyterKernelspecs()).values())
              .map((kernel: JupyterKernelspec) => kernel.name).join(", ")
          }. Run 'quarto check jupyter' with your python environment activated to check python version used.`,
        ),
      );
    }
  } else if (typeof yamlJupyter === "object") {
    const jupyter = { ...yamlJupyter } as Record<string, unknown>;
    if (isJupyterKernelspec(jupyter.kernelspec)) {
      const kernelspec = jupyter.kernelspec;
      delete jupyter.kernelspec;
      return [kernelspec, jupyter];
    } else if (typeof (jupyter.kernel) === "string") {
      const kernelspec = await jupyterKernelspec(jupyter.kernel);
      if (kernelspec) {
        delete jupyter.kernel;
        return [kernelspec, jupyter];
      } else {
        return Promise.reject(
          new Error(
            `Jupyter kernel '${jupyter.kernel}' not found. Known kernels: ${
              Array.from((await jupyterKernelspecs()).values())
                .map((kernel: JupyterKernelspec) => kernel.name).join(", ")
            }. Run 'quarto check jupyter' with your python environment activated to check python version used.`,
          ),
        );
      }
    } else {
      return Promise.reject(
        new Error(
          "Invalid Jupyter kernelspec (must include name, language, & display_name)",
        ),
      );
    }
  } else {
    return Promise.reject(
      new Error(
        "Invalid jupyter YAML metadata found in file (must be string or object)",
      ),
    );
  }
}

export function jupyterKernelspecFromFile(
  file: string,
): Promise<[JupyterKernelspec, Metadata]> {
  const markdown = Deno.readTextFileSync(file);
  return jupyterKernelspecFromMarkdown(markdown);
}

export function jupyterFromFile(input: string): JupyterNotebook {
  const nbContents = Deno.readTextFileSync(input);
  return jupyterFromJSON(nbContents);
}

export function jupyterFromJSON(nbContents: string): JupyterNotebook {
  // parse the notebook

  const nbJSON = JSON.parse(nbContents);
  const nb = nbJSON as JupyterNotebook;

  // vscode doesn't write a language to the kernelspec so also try language_info
  // google colab doesn't write a language at all, in that case try to deduce off of name
  if (!nb.metadata.kernelspec?.language) {
    if (nb.metadata.kernelspec) {
      nb.metadata.kernelspec.language = nbJSON.metadata.language_info?.name;
      if (
        !nb.metadata.kernelspec.language &&
        nb.metadata.kernelspec.name?.includes("python")
      ) {
        nb.metadata.kernelspec.language = "python";
      }
    } else {
      // provide default
      nb.metadata.kernelspec = jupyterDefaultPythonKernelspec();
    }
  }

  // validate that we have a language
  if (!nb.metadata.kernelspec.language) {
    throw new Error("No language set for Jupyter notebook");
  }

  // validate that we have cells
  if (!nb.cells) {
    throw new Error("No cells available in Jupyter notebook");
  }

  return nb;
}

export function jupyterAutoIdentifier(label: string) {
  label = pandocAsciify(label);

  label = label
    // Replace all spaces with hyphens
    .replace(/\s/g, "-")
    // Remove invalid chars
    .replace(/[^a-zA-Z0-9-_]/g, "")
    // Remove everything up to the first letter
    .replace(/^[^A-Za-z]+/, "");

  // if it's empty then create a random id
  if (label.length > 0) {
    return label.slice(0, 64);
  } else {
    return shortUuid();
  }
}

export interface JupyterNotebookAssetPaths {
  base_dir: string;
  files_dir: string;
  figures_dir: string;
  supporting_dir: string;
}

export function jupyterAssets(
  input: string,
  to?: string,
): JupyterNotebookAssetPaths {
  // calculate and create directories
  input = normalizePath(input);
  const files_dir = join(dirname(input), inputFilesDir(input));
  const figures_dir = join(files_dir, figuresDir(to));
  ensureDirSync(figures_dir);

  // determine supporting_dir (if there are no other figures dirs then it's
  // the files dir, otherwise it's just the figures dir). note that
  // supporting_dir is the directory that gets removed after a self-contained
  // or non-keeping render is complete
  let supporting_dir = files_dir;
  for (
    const walk of walkSync(join(files_dir), { maxDepth: 1 })
  ) {
    if (walk.path !== files_dir && walk.path !== figures_dir) {
      supporting_dir = figures_dir;
      break;
    }
  }

  const base_dir = dirname(input);
  return {
    base_dir,
    files_dir: pathWithForwardSlashes(relative(base_dir, files_dir)),
    figures_dir: pathWithForwardSlashes(relative(base_dir, figures_dir)),
    supporting_dir: pathWithForwardSlashes(relative(base_dir, supporting_dir)),
  };
}

export function cleanEmptyJupyterAssets(assets: JupyterNotebookAssetPaths) {
  const figuresRemoved = removeIfEmptyDir(
    join(assets.base_dir, assets.figures_dir),
  );
  const filesRemoved = removeIfEmptyDir(
    join(assets.base_dir, assets.files_dir),
  );
  return figuresRemoved && filesRemoved;
}

// Attach fully rendered notebook to render services
// Render notebook only once per document
// Return cells with markdown instead of complete markdown
// filter output markdown cells rather than notebook input

export async function jupyterToMarkdown(
  nb: JupyterNotebook,
  options: JupyterToMarkdownOptions,
): Promise<JupyterToMarkdownResult> {
  // perform fixups

  const project = options.executeOptions.project;
  const projType = project?.config?.project?.[kProjectType];

  if (projType === "book") {
    nb = fixupJupyterNotebook(nb, bookFixups);
  } else if (project?.isSingleFile) {
    nb = fixupJupyterNotebook(nb, options.fixups || "default");
  } else if (
    (project?.config?.title !== undefined &&
      (projType === "default" || projType === undefined))
  ) {
    nb = fixupJupyterNotebook(nb, minimalFixups);
  } else {
    nb = fixupJupyterNotebook(nb, options.fixups || "default");
  }

  // optional content injection / html preservation for html output
  // that isn't an ipynb
  const isHtml = options.toHtml && !options.toIpynb;
  const dependencies = isHtml
    ? extractJupyterWidgetDependencies(nb)
    : undefined;
  const htmlPreserve = isHtml ? removeAndPreserveHtml(nb) : undefined;

  // generate markdown
  const cellOutputs: JupyterCellOutput[] = [];

  // validate unique cell labels as we go
  const validateCellLabel = cellLabelValidator();

  // track current code cell index (for progress)
  let codeCellIndex = 0;

  let frontMatter = undefined;

  for (let i = 0; i < nb.cells.length; i++) {
    // Collection the markdown for this cell
    const md: string[] = [];

    // convert cell yaml to cell metadata
    const cell = jupyterCellWithOptions(
      i,
      nb.metadata.kernelspec.language.toLowerCase(),
      nb.cells[i],
    );

    // validate unique cell labels
    validateCellLabel(cell);

    // interpret cell slide_type for presentation output
    const slideType = options.toPresentation
      ? cell.metadata[kCellSlideshow]?.[kCellSlideshowSlideType]
      : undefined;
    if (slideType) {
      // write any implied delimeter (or skip entirely)
      if (slideType === "skip") {
        continue;
      } else if (slideType == "slide" || slideType === "subslide") {
        md.push("\n---\n\n");
      } else if (slideType == "fragment") {
        md.push("\n. . .\n\n");
      } else if (slideType == "notes") {
        md.push("\n:::::::::: notes\n\n");
      }
    }

    // find the first yaml metadata block and hold it out
    // note if it has a title
    // at the end, if it doesn't have a title, then snip the title out

    // markdown from cell
    switch (cell.cell_type) {
      case "markdown":
        {
          const markdownOptions = {
            ...options,
          };

          // If this is the front matter cell, don't wrap it in
          // a cell envelope, as it need to be remain discoverable
          if (frontMatter === undefined) {
            frontMatter = partitionYamlFrontMatter(
              jupyterCellSrcAsStr(cell),
            )?.yaml;
            if (frontMatter) {
              markdownOptions.preserveCellMetadata = false;
            }
          }
          md.push(...mdFromContentCell(cell, markdownOptions));
        }
        break;
      case "raw":
        md.push(...mdFromRawCell(cell, options));
        break;
      case "code":
        md.push(...(await mdFromCodeCell(cell, ++codeCellIndex, options)));
        break;
      default:
        throw new Error("Unexpected cell type " + cell.cell_type);
    }

    // terminate slide notes
    if (slideType === "notes") {
      md.push("\n::::::::::\n");
    }

    // newline
    md.push("\n");

    cellOutputs.push({
      id: cell.id,
      markdown: md.join(""),
      metadata: cell.metadata,
      options: cell.options,
    });
  }

  // include jupyter metadata if we are targeting ipynb
  let notebookOutputs = undefined;
  if (options.toIpynb) {
    const md: string[] = [];
    md.push("---\n");

    // If widgets are present, base64 encode their metadata to prevent true round
    // tripping through YAML, which heavily mutates the metadata
    const widgets = nb.metadata.widgets
      ? encodeBase64(JSON.stringify(nb.metadata.widgets))
      : undefined;

    const jupyterMetadata = {
      jupyter: {
        ...nb.metadata,
        widgets,
      },
    };
    const yamlText = stringify(jupyterMetadata, {
      indent: 2,
      lineWidth: -1,
      sortKeys: false,
      skipInvalid: true,
    });
    md.push(yamlText);
    md.push("---\n");
    notebookOutputs = {
      suffix: md.join(""),
    };
  }

  // return markdown and any widget requirements
  return {
    cellOutputs,
    notebookOutputs,
    dependencies,
    htmlPreserve,
  };
}

export function jupyterCellWithOptions(
  index: number,
  language: string,
  cell: JupyterCell,
): JupyterCellWithOptions {
  const { yaml, optionsSource, source } = partitionCellOptions(
    language,
    jupyterCellSrcAsLines(cell),
  );

  // read any options defined in cell metadata
  const metadataOptions: Record<string, unknown> = kJupyterCellOptionKeys
    .reduce((options, key) => {
      if (cell.metadata[key] !== undefined) {
        options[key] = cell.metadata[key];
      }
      return options;
    }, {} as Record<string, unknown>);

  // combine metadata options with yaml options (giving yaml options priority)
  const explicitOptions = {
    ...metadataOptions,
    ...yaml,
  };

  // if we have layout or tbl-colwidths and it's not a string then json encode it
  [kLayout, kTblColwidths].forEach((option) => {
    if (
      explicitOptions[option] && typeof (explicitOptions[option]) !== "string"
    ) {
      explicitOptions[option] = JSON.stringify(explicitOptions[option]);
    }
  });

  // Resolve any tags that map to options
  const tags = cell.metadata.tags;
  const tagOptions = tagsToOptions(tags || []);
  const options = {
    ...tagOptions,
    ...explicitOptions,
  };

  // Ensure that the cell has an id - the id will be
  // unique within this notebook thanks to the index
  const cellId = (cell: JupyterCell) => {
    if (
      options && options[kCellLabel] &&
      typeof (options[kCellLabel]) === "string"
    ) {
      return `cell-${options[kCellLabel]}`;
    } else if (cell.id) {
      return cell.id;
    } else {
      return `cell-${index}`;
    }
  };

  const validMetadata: Record<
    string,
    string | number | boolean | null | Array<unknown>
  > = {};
  for (const key of Object.keys(cell.metadata)) {
    const value = cell.metadata[key];
    let jsonEncodedKeyIndex = 0;
    if (value !== undefined) {
      if (!value && typeof value === "object") {
        validMetadata[key] = null;
      } else if (value && typeof value === "object" && !Array.isArray(value)) {
        // https://github.com/quarto-dev/quarto-cli/issues/9089
        // we need to json-encode this and signal the encoding in the key
        // we can't use the key as is since it may contain invalid characters
        // and modifying the key might introduce collisions
        // we ensure the key is unique with a counter, and assume
        // "quarto-private-*" to be a private namespace for quarto.
        // we'd prefer to use _quarto-* instead, but Pandoc doesn't allow keys to start
        // with an underscore.
        validMetadata[
          `quarto-private-${++jsonEncodedKeyIndex}`
        ] = JSON.stringify({ key, value });
      } else if (
        typeof value === "string" || typeof value === "number" ||
        typeof value === "boolean" || Array.isArray(value)
      ) {
        validMetadata[key] = value;
      } else {
        error(
          `Invalid metadata type for key ${key}: ${typeof value}. Entry will not be serialized.`,
        );
      }
    }
  }

  return {
    ...cell,
    metadata: validMetadata,
    id: cellId(cell),
    source,
    optionsSource,
    options,
  };
}

export function jupyterCellOptionsAsComment(
  language: string,
  options: Record<string, unknown>,
  // deno-lint-ignore no-explicit-any
  stringifyOptions?: any,
) {
  if (Object.keys(options).length > 0) {
    const cellYaml = stringify(options, {
      indent: 2,
      lineWidth: -1,
      sortKeys: false,
      skipInvalid: true,
      ...stringifyOptions,
    });
    const commentChars = langCommentChars(language);
    const yamlOutput = trimEmptyLines(lines(cellYaml)).map((line) => {
      line = optionCommentPrefix(commentChars[0]) + line +
        optionCommentSuffix(commentChars[1]);
      return line + "\n";
    });
    return yamlOutput;
  } else {
    return [];
  }
}

export function mdFromContentCell(
  cell: JupyterCellWithOptions,
  options?: JupyterToMarkdownOptions,
) {
  const contentCellEnvelope = createCellEnvelope(["cell", "markdown"], options);

  // clone source for manipulation
  const source = typeof cell.source === "string"
    ? [cell.source]
    : [...cell.source];

  // handle user expressions (if any)
  if (options && source) {
    const userExpressions = userExpressionsFromCell(cell);
    resolveUserExpressions(source, userExpressions, options);
  }

  // if we have attachments then extract them and markup the source
  if (options && cell.attachments && source) {
    // close source so we can modify it
    Object.keys(cell.attachments).forEach((file, index) => {
      const attachment = cell.attachments![file];
      for (const mimeType of Object.keys(attachment)) {
        if (extensionForMimeImageType(mimeType, undefined)) {
          // save attachment in the figures dir
          const imageFile = options.assets.figures_dir +
            `/${cell.id}-${index + 1}-${file}`;
          const outputFile = join(options.assets.base_dir, imageFile);
          ensureDirSync(dirname(outputFile));
          const data = attachment[mimeType];
          // get the data
          const imageText = Array.isArray(data)
            ? (data as string[]).join("")
            : data as string;
          // base 64 decode if its not svg
          if (!imageText.trimStart().startsWith("<svg")) {
            const imageData = base64decode(imageText.replaceAll("\n", ""));
            Deno.writeFileSync(outputFile, imageData);
          } else {
            Deno.writeTextFileSync(outputFile, imageText);
          }
          // replace it in source
          for (let i = 0; i < source.length; i++) {
            source[i] = source[i].replaceAll(
              `attachment:${file}`,
              () => imageFile,
            );
          }
          // only process one supported mime type
          break;
        }
      }
    });
  }

  return contentCellEnvelope(cell.id, mdEnsureTrailingNewline(source));
}

export function mdFormatOutput(format: string, source: string[]) {
  const ticks = ticksForCode(source);
  return mdEnclosedOutput(ticks + "{=" + format + "}", source, ticks);
}

export function mdRawOutput(mimeType: string, source: string[]) {
  switch (mimeType) {
    case kTextHtml:
      return mdHtmlOutput(source);
    case kTextLatex:
      return mdLatexOutput(source);
    case kRestructuredText:
      return mdFormatOutput("rst", source);
    case kApplicationRtf:
      return mdFormatOutput("rtf", source);
    case kApplicationJavascript:
      return mdScriptOutput(mimeType, source);
  }
}

export function mdFromRawCell(
  cell: JupyterCellWithOptions,
  options?: JupyterToMarkdownOptions,
) {
  const rawCellEnvelope = createCellEnvelope(["cell", "raw"], options);

  const mimeType = cell.metadata?.[kCellRawMimeType];
  if (mimeType) {
    const rawOutput = mdRawOutput(mimeType, jupyterCellSrcAsLines(cell));
    if (rawOutput) {
      return rawCellEnvelope(cell.id, rawOutput);
    }
  }

  return mdFromContentCell(
    cell,
    options
      ? {
        ...options,
        preserveCellMetadata: false,
      }
      : undefined,
  );
}

export function mdEnsureTrailingNewline(source: string[]) {
  if (source.length > 0 && !source[source.length - 1].endsWith("\n")) {
    return source.slice(0, source.length - 1).concat(
      [source[source.length - 1] + "\n"],
    );
  } else {
    return source;
  }
}

// We decode some tags on cells into options for the cell
// to better support control of Notebook code behavior when
// included within documents (without requiring the addition of
// configuration comments within the code cell)
export const kHideCell = "hide-cell";
export const kHideCode = "hide-code";
export const kHideOutput = "hide-output";
export const kHideWarnings = "hide-warnings";
export const kShowCode = "show-code";
export const kShowOutput = "show-output";
export const kShowWarnings = "show-warnings";
export const kRemoveCell = "remove-cell";
const tagMapping: Record<string, Record<string, boolean>> = {
  [kHideCell]: {
    include: false,
  },
  [kHideCode]: {
    echo: false,
  },
  [kHideOutput]: {
    output: false,
  },
  [kHideWarnings]: {
    warning: false,
  },
  [kShowCode]: {
    echo: true,
  },
  [kShowOutput]: {
    output: true,
  },
  [kShowWarnings]: {
    warning: true,
  },
  [kRemoveCell]: {
    include: false,
  },
};

function createCellEnvelope(
  classes: string[],
  options?: JupyterToMarkdownOptions,
) {
  return (id: string, source: string | string[]) => {
    if (options && options.preserveCellMetadata) {
      const wrappedSource = [...source];
      wrappedSource.unshift(
        `:::{#${id} ${classes.map((clz) => `.${clz}`).join(" ")}}\n`,
      );
      wrappedSource.push(`:::`);
      return mdEnsureTrailingNewline(wrappedSource);
    } else {
      return source;
    }
  };
}

function tagsToOptions(tags: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  tags.forEach((tag) => {
    const mapping = tagMapping[tag];
    if (mapping) {
      const keys = Object.keys(mapping);
      keys.forEach((key) => {
        result[key] = mapping[key];
      });
    }
  });
  return result;
}

function optionCommentPrefix(comment: string) {
  return comment + "| ";
}
function optionCommentSuffix(comment?: string) {
  if (comment) {
    return " " + comment;
  } else {
    return "";
  }
}

function langCommentChars(lang: string): string[] {
  const chars = kLangCommentChars[lang] || "#";
  if (!Array.isArray(chars)) {
    return [chars];
  } else {
    return chars;
  }
}

const kLangCommentChars: Record<string, string | string[]> = {
  r: "#",
  python: "#",
  julia: "#",
  scala: "//",
  matlab: "%",
  csharp: "//",
  fsharp: "//",
  c: ["/*", "*/"],
  css: ["/*", "*/"],
  sas: ["*", ";"],
  powershell: "#",
  bash: "#",
  sql: "--",
  mysql: "--",
  psql: "--",
  lua: "--",
  cpp: "//",
  cc: "//",
  stan: "#",
  octave: "#",
  fortran: "!",
  fortran95: "!",
  awk: "#",
  gawk: "#",
  stata: "*",
  java: "//",
  groovy: "//",
  sed: "#",
  perl: "#",
  ruby: "#",
  tikz: "%",
  js: "//",
  d3: "//",
  node: "//",
  sass: "//",
  coffee: "#",
  go: "//",
  asy: "//",
  haskell: "--",
  dot: "//",
  mermaid: "%%",
  apl: "⍝",
  ocaml: ["(*", "*)"],
  rust: "//",
};

function cleanJupyterOutputDisplayData(
  output: JupyterOutput,
): JupyterOutputDisplayData {
  const rawOutput = (output as unknown) as Record<string, unknown>;

  const outputData: { [mimeType: string]: unknown } = {};

  for (
    const [key, value] of Object.entries(
      rawOutput.data as { [mimeType: string]: unknown },
    )
  ) {
    const strValue = (typeof value === "string")
      ? [value]
      : (Array.isArray(value) &&
          value.every((x) => typeof x === "string"))
      ? value as string[]
      : undefined;
    if (strValue === undefined) {
      // if it's not a string type then allow it to pass through
      // (see https://github.com/quarto-dev/quarto-cli/issues/2445)
      outputData[key] = value;
    } else {
      outputData[key] = strValue;
    }
  }

  return {
    ...output,
    data: outputData,
    metadata: rawOutput.metadata as {
      [mimetype: string]: Record<string, unknown>;
    },
    noCaption: rawOutput.noCaption as (boolean | undefined),
  };
}

async function mdFromCodeCell(
  cell: JupyterCellWithOptions,
  cellIndex: number,
  options: JupyterToMarkdownOptions,
) {
  // bail if we aren't including this cell
  if (!includeCell(cell, options)) {
    return [];
  }

  // check if we have any image output
  const haveImage = !!cell.outputs?.some((output) => isImage(output, options));

  // filter and transform outputs as needed
  const outputs = (cell.outputs || []).filter((output) => {
    // filter warnings if requested
    if (
      output.output_type === "stream" &&
      (output as JupyterOutputStream).name === "stderr" &&
      !includeWarnings(cell, options)
    ) {
      return false;
    }

    // filter matplotlib intermediate vars
    if (isDiscardableTextExecuteResult(output, haveImage)) {
      return false;
    }

    return true;
  }).map((output) => {
    // convert text/latex math to markdown as appropriate
    if (!options.toLatex && isDisplayData(output) && output.data[kTextLatex]) {
      return displayDataWithMarkdownMath(output);
    } else {
      return output;
    }
  });

  // redact if the cell has no source and no output
  if (!cell.source.length && !outputs.length) {
    return [];
  }

  // ouptut: asis should just include raw markup w/ no enclosures
  const asis =
    // specified as an explicit option for this cell
    cell.options[kOutput] === "asis" ||
    // specified globally with no output override for this cell
    (options.execute[kOutput] === "asis" &&
      cell.options[kOutput] === undefined);

  // markdown to return
  const md: string[] = [];

  // write div enclosure
  const divMd: string[] = [`::: {`];

  // metadata to exclude from cell div attributes
  const kCellOptionsFilter = kJupyterCellInternalOptionKeys.concat(
    kJupyterCellStandardMetadataKeys,
    kJupyterCellThirdPartyMetadataKeys,
  );

  // determine label -- this will be forwarded to the output (e.g. a figure)
  // if there is a single output. otherwise it will included on the enclosing
  // div and used as a prefix for the individual outputs
  const label = cellLabel(cell);
  const labelCellContainer = shouldLabelCellContainer(cell, outputs, options);
  if (label && labelCellContainer) {
    divMd.push(`${label} `);
  } else if (
    (isIpynbOutput(options.executeOptions.format.pandoc) ||
      isJatsOutput(options.executeOptions.format.pandoc) ||
      isHtmlOutput(options.executeOptions.format.pandoc)) && cell.id
  ) {
    // If we're targeting ipynb output, include the id in the
    // markdown. This will cause the id to be included in the
    // rendered notebook. Note that elsewhere we forard the
    // label to the id, so that can appear as the cell id.
    divMd.push(`#${cell.id} `);
  }

  // resolve caption (main vs. sub)
  let { cellCaption, outputCaptions } = resolveCaptions(cell);

  // https://github.com/quarto-dev/quarto-cli/issues/5413
  outputCaptions = outputCaptions.map((caption) =>
    caption.trim().replaceAll("\n", " ")
  );

  // cell_type classes
  divMd.push(`.cell `);

  // add hidden if requested
  if (hideCell(cell, options)) {
    divMd.push(`.hidden `);
  }

  // css classes
  const cellClasses = cell.options[kCellClasses]! || new Array<string>();
  const classes = Array.isArray(cellClasses) ? cellClasses : [cellClasses];
  if (typeof cell.options[kCellPanel] === "string") {
    classes.push(`panel-${cell.options[kCellPanel]}`);
  }
  if (typeof cell.options[kCellColumn] === "string") {
    classes.push(`column-${cell.options[kCellColumn]}`);
  }
  if (typeof cell.options[kCellFigColumn] === "string") {
    classes.push(`fig-column-${cell.options[kCellFigColumn]}`);
  }
  if (typeof cell.options[kCellTblColumn] === "string") {
    classes.push(`tbl-column-${cell.options[kCellTblColumn]}`);
  }
  if (typeof cell.options[kCapLoc] === "string") {
    classes.push(`caption-${cell.options[kFigCapLoc]}`);
  }
  if (typeof cell.options[kFigCapLoc] === "string") {
    classes.push(`fig-cap-location-${cell.options[kFigCapLoc]}`);
  }
  if (typeof cell.options[kTblCapLoc] === "string") {
    classes.push(`tbl-cap-location-${cell.options[kTblCapLoc]}`);
  }
  if (classes.length > 0) {
    const classText = classes
      .map((clz: string) => {
        clz = ld.toString(clz) as string;
        return clz.startsWith(".") ? clz : ("." + clz);
      })
      .join(" ");
    divMd.push(classText + " ");
  }

  // forward other attributes we don't know about (combine attributes
  // from options yaml and cell metadata)
  const cellOptions = {
    ...cell.metadata,
    ...cell.options,
  };

  let forwardedAttrs = false;
  for (const key of Object.keys(cellOptions)) {
    if (!kCellOptionsFilter.includes(key.toLowerCase())) {
      // deno-lint-ignore no-explicit-any
      let value = (cellOptions as any)[key];
      if (value !== undefined) {
        if (typeof value !== "string") {
          value = JSON.stringify(value);
        }
        value = value.replaceAll("'", `\\'`);
        divMd.push(`${key}='${value}' `);
        forwardedAttrs = true;
      }
    }
  }

  // in analogy to src/resources/rmd/hooks.R:403--406
  //
  // if there is a label, additional classes, a forwardAttr, or a cell.cap
  // then the user is deemed to have implicitly overridden results = "asis"
  // (as those features don't work w/o an enclosing div)
  const needCell = (label && labelCellContainer) || // isTRUE(nzchar(label))
    classes.length > 0 || // length(classes) > 1
    forwardedAttrs || // isTRUE(nzchar(forwardAttr))
    (cellCaption !== undefined || outputCaptions.length > 0); // isTRUE(nzchar(cell.cap))

  // add execution_count if we have one
  if (typeof (cell.execution_count) === "number") {
    divMd.push(`execution_count=${cell.execution_count} `);
  }

  // create string for div enclosure (we'll use it later but
  // only if there is actually content in the div)
  const divBeginMd = divMd.join("").replace(/ $/, "").concat("}\n");

  // write code if appropriate
  if (includeCode(cell, options) || options.preserveCodeCellYaml) {
    const fenced = echoFenced(cell, options);
    const ticks = "`".repeat(
      Math.max(countTicks(jupyterCellSrcAsLines(cell)) + 1, fenced ? 4 : 3),
    );

    md.push(ticks + " {");
    if (!options.preserveCodeCellYaml) {
      if (typeof cell.options[kCellLstLabel] === "string") {
        let label = cell.options[kCellLstLabel]!;
        if (!label.startsWith("#")) {
          label = "#" + label;
        }
        md.push(label + " ");
      }
      if (!fenced) {
        md.push("." + (cellOptions.language || options.language));
      }
      md.push(" .cell-code");
      if (hideCode(cell, options)) {
        md.push(" .hidden");
      }

      if (cell.options[kCodeOverflow] === "wrap") {
        md.push(" .code-overflow-wrap");
      } else if (cell.options[kCodeOverflow] === "scroll") {
        md.push(" .code-overflow-scroll");
      }

      if (typeof cell.options[kCellLstCap] === "string") {
        md.push(` lst-cap=\"${cell.options[kCellLstCap]}\"`);
      }
      if (typeof cell.options[kCodeFold] !== "undefined") {
        md.push(` code-fold=\"${cell.options[kCodeFold]}\"`);
      }
      if (typeof cell.options[kCodeSummary] !== "undefined") {
        md.push(` code-summary=\"${cell.options[kCodeSummary]}\"`);
      }
      if (typeof cell.options[kCodeLineNumbers] !== "undefined") {
        md.push(` code-line-numbers=\"${cell.options[kCodeLineNumbers]}\"`);
      }
    }
    md.push("}\n");
    let source = typeof cell.source === "string"
      ? [cell.source]
      : [...cell.source];
    if (fenced) {
      const optionsSource = cell.optionsSource.filter((line) =>
        line.search(/\|\s+echo:\s+fenced\s*$/) === -1
      );
      if (optionsSource.length > 0) {
        source = trimEmptyLines(source, "trailing");
      } else {
        source = trimEmptyLines(source, "all");
      }
      source.unshift(...optionsSource);
      source.unshift("```{{" + options.language + "}}\n");
      source.push("\n```\n");
    } else if (cell.optionsSource.length > 0) {
      source = trimEmptyLines(source, "leading");
    }
    if (options.preserveCodeCellYaml) {
      md.push(...cell.optionsSource);
    }
    md.push(...source, "\n");
    md.push(ticks + "\n");
  }

  // write output if approproate (output: asis gets special handling)
  if (includeOutput(cell, options)) {
    // compute label prefix for output (in case we need it for files, etc.)
    const labelName = label
      ? label.replace(/^#/, "").replaceAll(":", "-")
      : ("cell-" + (cellIndex + 1));

    // strip spaces, special characters, etc. for latex friendly paths
    const outputName = `${
      options.outputPrefix ? options.outputPrefix + "-" : ""
    }${pandocAutoIdentifier(labelName, true)}-output`;
    let nextOutputSuffix = 1;
    const sortedOutputs = outputs.map((value, index) => ({
      index,
      output: value,
    })).sort((a, b) => {
      // Sort any explicitly ordered cells
      const aIdx = a.output.metadata?.[kQuartoOutputOrder] !== undefined
        ? a.output.metadata?.[kQuartoOutputOrder] as number
        : Number.MAX_SAFE_INTEGER;
      const bIdx = b.output.metadata?.[kQuartoOutputOrder] !== undefined
        ? b.output.metadata?.[kQuartoOutputOrder] as number
        : Number.MAX_SAFE_INTEGER;
      return aIdx - bIdx;
    });

    for (const { index, output } of sortedOutputs) {
      // compute output label
      const outputLabel = label && labelCellContainer && isDisplayData(output)
        ? (label + "-" + nextOutputSuffix++)
        : label;

      // If this output has been marked to not be displayed
      // just continue
      if (output.metadata?.[kQuartoOutputDisplay] === false) {
        continue;
      }

      // leading newline and beginning of div
      if (!asis) {
        md.push("\n::: {");

        // include label/id if appropriate
        if (
          outputLabel &&
          shouldLabelOutputContainer(output, cell.options, options)
        ) {
          md.push(outputLabel + " ");
        }

        // add generic output class
        md.push(".cell-output ");

        // add output class name
        if (output.output_type === "stream") {
          const stream = output as JupyterOutputStream;
          md.push(`.cell-output-${stream.name}`);
        } else {
          md.push(`.${outputTypeCssClass(output.output_type)}`);
        }

        // if this is markdown output then include a special class for that
        if (isMarkdown(output, options)) {
          md.push(` .${outputTypeCssClass("markdown")}`);
        }

        // add hidden if necessary
        if (
          hideOutput(cell, options) ||
          (isWarningOutput(output) && hideWarnings(cell, options))
        ) {
          md.push(` .hidden`);
        }

        // add execution count if we have one
        if (typeof (output.execution_count) === "number") {
          md.push(` execution_count=${output.execution_count}`);
        }

        if (cell.options[kHtmlTableProcessing] === "none") {
          md.push(" html-table-processing=none");
        }

        md.push("}\n");
      }

      // for latex, provide fig-pos='H' if there is no other setting of fig-pos
      // and code is being included w/ the figure
      if (
        options.toLatex &&
        !options.figPos && !cell.options[kCellFigPos] &&
        !hasLayoutOptions(cell) &&
        includeCode(cell, options)
      ) {
        cell.options[kCellFigPos] = "H";
      }

      // broadcast figure options
      const figureOptions: JupyterOutputFigureOptions = {};
      const broadcastFigureOption = (
        name:
          | "fig-align"
          | "fig-link"
          | "fig-env"
          | "fig-pos"
          | "fig-scap"
          | "fig-alt",
      ) => {
        const value = cell.options[name];
        if (value) {
          if (Array.isArray(value)) {
            return value[index];
          } else {
            return value;
          }
        } else {
          return null;
        }
      };
      figureOptions[kCellFigAlign] = broadcastFigureOption(kCellFigAlign);
      figureOptions[kCellFigScap] = broadcastFigureOption(kCellFigScap);
      figureOptions[kCellFigLink] = broadcastFigureOption(kCellFigLink);
      figureOptions[kCellFigEnv] = broadcastFigureOption(kCellFigEnv);
      figureOptions[kCellFigPos] = broadcastFigureOption(kCellFigPos);
      figureOptions[kCellFigAlt] = broadcastFigureOption(kCellFigAlt);

      // if there isn't a cell or document level fig-pos and
      // we are including output then automatically set fig-pos='H'

      // produce output
      if (output.output_type === "stream") {
        const stream = output as JupyterOutputStream;
        if (asis && stream.name === "stdout") {
          let text: string[] = [];
          if (typeof stream.text === "string") {
            text = [stream.text];
          } else {
            text = stream.text;
          }
          md.push(text.join(""));
        } else {
          md.push(await mdOutputStream(stream, options));
        }
      } else if (output.output_type === "error") {
        md.push(await mdOutputError(output as JupyterOutputError, options));
      } else if (isDisplayData(output)) {
        const fixedOutput = cleanJupyterOutputDisplayData(output);
        if (Object.keys(fixedOutput.data).length > 0) {
          const caption = isCaptionableData(output)
            ? (outputCaptions.shift() || null)
            : null;
          md.push(
            await mdOutputDisplayData(
              outputLabel,
              caption,
              outputName + "-" + (index + 1),
              fixedOutput,
              options,
              figureOptions,
            ),
          );
          // if this isn't an image and we have a caption, place it at the bottom of the div
          if (caption && !isImage(output, options)) {
            md.push(`\n${caption}\n`);
          }
        }
      } else {
        throw new Error("Unexpected output type " + output.output_type);
      }

      // terminate div
      if (!asis) {
        md.push(`:::\n`);
      }
    }
    // not including output...still check if there are ojs_define outputs to write
    // (ojs_define should evade output: false)
  } else if (cell.outputs) {
    cell.outputs
      .filter(isDisplayData)
      .filter((output) =>
        (output as JupyterOutputDisplayData).metadata.ojs_define
      )
      .forEach((ojs_define) => {
        const ojs_html = (ojs_define as JupyterOutputDisplayData)
          .data[kTextHtml] as string[];
        md.push("\n" + mdHtmlOutput(ojs_html));
      });
  }

  // write md w/ div enclosure (if there is any md to write)
  if (md.length > 0 && (needCell || !asis)) {
    // begin
    md.unshift(divBeginMd);

    // see if there is a cell caption
    if (cellCaption) {
      md.push("\n" + cellCaption + "\n");
    }

    // end div
    md.push(":::\n");
  }

  // lines to next cell
  md.push("\n".repeat(cell.metadata.lines_to_next_cell || 1));

  // if we have kCellMdIndent then join, split on \n, apply indent, then re-join
  if (cell.options[kCellMdIndent]) {
    const indent = String(cell.options[kCellMdIndent]);
    const mdWithIndent = md
      .join("")
      .split("\n")
      .map((line) => indent + line)
      .join("\n");
    md.splice(0, md.length - 1);
    md.push(...mdWithIndent);
  }

  return md;
}

function isDiscardableTextExecuteResult(
  output: JupyterOutput,
  haveImage: boolean,
) {
  if (output.output_type === "execute_result") {
    const data = (output as JupyterOutputDisplayData).data;
    if (Object.keys(data).length === 1) {
      const textPlain = data?.[kTextPlain] as string[] | undefined;
      if (textPlain && textPlain.length) {
        if (haveImage && textPlain.length === 1) {
          return /^([<(\[]).*?([>)\]])$/.test(textPlain[0].trim());
        } else {
          return [
            "[<matplotlib",
            "<matplotlib",
            "<seaborn.",
            "<ggplot:",
          ].some((startsWith) => textPlain[0].startsWith(startsWith));
        }
      }
    }
  }
  return false;
}

function hasLayoutOptions(cell: JupyterCellWithOptions) {
  return Object.keys(cell.options).some((key) => key.startsWith("layout"));
}

function isDisplayDataType(
  output: JupyterOutput,
  options: JupyterToMarkdownOptions,
  checkFn: (mimeType: string) => boolean,
) {
  if (isDisplayData(output)) {
    const mimeType = displayDataMimeType(
      output as JupyterOutputDisplayData,
      options,
    );
    if (mimeType) {
      if (checkFn(mimeType)) {
        return true;
      }
    }
  }
  return false;
}

function isImage(output: JupyterOutput, options: JupyterToMarkdownOptions) {
  return isDisplayDataType(output, options, displayDataIsImage);
}

function isMarkdown(output: JupyterOutput, options: JupyterToMarkdownOptions) {
  return isDisplayDataType(output, options, displayDataIsMarkdown);
}

async function mdOutputStream(
  output: JupyterOutputStream,
  options: JupyterToMarkdownOptions,
) {
  let text: string[] = [];
  if (typeof output.text === "string") {
    text = [output.text];
  } else {
    text = output.text;
  }

  // trim off warning source line for notebook
  if (output.name === "stderr") {
    if (text[0]) {
      const firstLine = text[0].replace(
        /<ipython-input.*?>:\d+:\s+/,
        "",
      );
      text = [firstLine, ...text.slice(1)];
    }
  }

  if (options.toHtml && text.some(hasAnsiEscapeCodes)) {
    const linesHTML = await convertToHtmlSpans(text.join("\n"));
    return mdMarkdownOutput(
      [
        "\n::: {.ansi-escaped-output}\n```{=html}\n<pre>",
        linesHTML,
        "</pre>\n```\n:::\n",
      ],
    );
  } else {
    // normal default behavior
    return mdCodeOutput(text.map(colors.stripAnsiCode));
  }
}

async function mdOutputError(
  output: JupyterOutputError,
  options: JupyterToMarkdownOptions,
) {
  const traceback = output.traceback.join("\n");
  if (
    !options.toHtml ||
    (!hasAnsiEscapeCodes(output.evalue) && !hasAnsiEscapeCodes(traceback))
  ) {
    if (output.traceback.length > 0) {
      return mdCodeOutput([
        output.ename + ": " + output.evalue + "\n" + traceback,
      ]);
    } else {
      return mdCodeOutput([
        output.ename + ": " + output.evalue,
      ]);
    }
  }
  const tracebackHtml = await convertToHtmlSpans(traceback);
  return mdMarkdownOutput(
    [
      "\n::: {.ansi-escaped-output}\n```{=html}\n<pre>",
      tracebackHtml,
      "</pre>\n```\n:::\n",
    ],
  );
}

async function mdOutputDisplayData(
  label: string | null,
  caption: string | null,
  filename: string,
  output: JupyterOutputDisplayData,
  options: JupyterToMarkdownOptions,
  figureOptions: JupyterOutputFigureOptions,
) {
  const mimeType = displayDataMimeType(output, options);
  if (mimeType) {
    if (displayDataIsImage(mimeType)) {
      return mdImageOutput(
        label,
        caption,
        filename,
        mimeType,
        output,
        options,
        figureOptions,
      );
    } else if (displayDataIsMarkdown(mimeType)) {
      return mdMarkdownOutput(output.data[mimeType] as string[]);
    } else if (displayDataIsLatex(mimeType)) {
      return mdLatexOutput(output.data[mimeType] as string[]);
    } else if (displayDataIsHtml(mimeType)) {
      return mdHtmlOutput(output.data[mimeType] as string[]);
    } else if (displayDataIsJson(mimeType)) {
      // Add the literal mimetype information to the payload, for later use
      const json = output.data[mimeType] as Record<string, unknown>;
      json[kQuartoMimeType] = mimeType;
      return mdJsonOutput(
        mimeType,
        json,
        options,
      );
    } else if (displayDataIsJavascript(mimeType)) {
      return mdScriptOutput(mimeType, output.data[mimeType] as string[]);
    } else if (displayDataIsTextPlain(mimeType)) {
      // https://github.com/quarto-dev/quarto-cli/issues/1874
      // this indicates output.data[mimeType] is not always string[]
      //
      // if output is invalid, warn and emit empty
      const data = output.data[mimeType] as unknown;
      if (!Array.isArray(data) || data.some((s) => typeof s !== "string")) {
        return await mdWarningOutput(
          `Unable to process text plain output data 
which does not appear to be plain text: ${JSON.stringify(data)}`,
          options,
        );
      }
      const lines = data as string[];
      // pandas inexplicably outputs html tables as text/plain with an enclosing single-quote
      if (
        lines.length === 1 &&
        lines[0].startsWith("'<table") &&
        lines[0].endsWith("</table>'")
      ) {
        lines[0] = lines[0].slice(1, -1);
        return mdMarkdownOutput(lines);
      } else {
        if (options.toHtml) {
          if (lines.some(hasAnsiEscapeCodes)) {
            const html = await Promise.all(
              lines.map(convertToHtmlSpans),
            );
            return mdMarkdownOutput(
              [
                "\n::: {.ansi-escaped-output}\n```{=html}\n<pre>",
                ...html,
                "</pre>\n```\n:::\n",
              ],
            );
          } else {
            return mdCodeOutput(lines);
          }
        } else {
          return mdCodeOutput(lines.map(colors.stripAnsiCode));
        }
      }
    }
  }

  // no type match found
  return await mdWarningOutput(
    "Unable to display output for mime type(s): " +
      Object.keys(output.data).join(", "),
    options,
  );
}

function mdImageOutput(
  label: string | null,
  caption: string | null,
  filename: string,
  mimeType: string,
  output: JupyterOutputDisplayData,
  options: JupyterToMarkdownOptions,
  figureOptions: JupyterOutputFigureOptions,
) {
  // alias output properties
  const data = output.data[mimeType] as string[];
  const metadata = output.metadata[mimeType];

  // attributes (e.g. width/height/alt)
  function metadataValue<T>(key: string, defaultValue?: T) {
    if (metadata) {
      return metadata[key] ? metadata[key] as T : defaultValue;
    }
    return defaultValue;
  }
  let width = metadataValue(kCellOutWidth) ?? metadataValue(kCellWidth, 0);
  let height = metadataValue(kCellOutHeight) ?? metadataValue(kCellHeight, 0);
  const alt = caption || "";

  // calculate output file name
  const ext = extensionForMimeImageType(mimeType);
  const imageFile = options.assets.figures_dir + "/" + filename + "." + ext;

  // get the data
  const imageText = Array.isArray(data)
    ? (data as string[]).join("")
    : (data as string).trim();

  const outputFile = join(options.assets.base_dir, imageFile);
  if (
    // base64 decode if it's not svg
    mimeType !== kImageSvg ||
    // or if it is encoded svg; this could happen when used in embed context,
    // as Pandoc will generate ipynb with base64 encoded svg data
    // https://github.com/quarto-dev/quarto-cli/issues/9793
    !/<svg/.test(imageText)
  ) {
    // we need to remove the newlines from the base64 encoded data
    // because base64decode doesn't like the multiline-encoded style
    const imageData = base64decode(imageText.replaceAll("\n", ""));

    // if we are in retina mode, then derive width and height from the image
    if (
      mimeType === kImagePng && options.figFormat === "retina" && options.figDpi
    ) {
      const png = new PngImage(imageData);
      if (
        png.dpiX === (options.figDpi * 2) && png.dpiY === (options.figDpi * 2)
      ) {
        width = Math.round(png.width / 2);
        height = Math.round(png.height / 2);
      }
    }
    Deno.writeFileSync(outputFile, imageData);
  } else {
    Deno.writeTextFileSync(outputFile, imageText);
  }

  const kFigOptions = [
    kCellFigAlign,
    kCellFigEnv,
    kCellFigAlt,
    kCellFigPos,
    kCellFigScap,
  ];

  let image = `![${alt}](${imageFile})`;
  if (
    label || width || height ||
    Object.keys(figureOptions).some((option) => kFigOptions.includes(option))
  ) {
    image += "{";
    if (label) {
      image += `${label} `;
    }
    if (width) {
      image += `width=${width} `;
    }
    if (height) {
      image += `height=${height} `;
    }
    kFigOptions
      .forEach(
        (attrib) => {
          // deno-lint-ignore no-explicit-any
          const value = (figureOptions as any)[attrib];
          if (value) {
            image += `${attrib}='${value.replaceAll("'", "\\'")}' `;
          }
        },
      );

    image = image.trimRight() + "}";
  }

  // surround with link if we have one
  if (figureOptions[kCellFigLink]) {
    image = `[${image}](${figureOptions[kCellFigLink]})`;
  }

  return mdMarkdownOutput([image]);
}

function mdMarkdownOutput(md: string[]) {
  return md.join("") + "\n";
}

function mdLatexOutput(latex: string[]) {
  return mdFormatOutput("tex", latex);
}

function mdHtmlOutput(html: string[]) {
  return mdFormatOutput("html", html);
}

function mdJsonOutput(
  mimeType: string,
  json: Record<string, unknown>,
  options: JupyterToMarkdownOptions,
) {
  if (options.toIpynb) {
    return mdCodeOutput([JSON.stringify(json)], "json");
  } else {
    return mdScriptOutput(mimeType, [JSON.stringify(json)]);
  }
}

function mdScriptOutput(mimeType: string, script: string[]) {
  const scriptTag = [
    `<script type="${mimeType}">\n`,
    ...script,
    "\n</script>",
  ];
  return mdHtmlOutput(scriptTag);
}

function mdCodeOutput(code: string[], clz?: string) {
  const ticks = ticksForCode(code);
  const open = ticks + (clz ? `{.${clz}}` : "");
  return mdEnclosedOutput(open, code, ticks);
}

function mdEnclosedOutput(begin: string, text: string[], end: string) {
  const output = text.join("");
  const md: string[] = [
    begin + "\n",
    output + (output.endsWith("\n") ? "" : "\n"),
    end + "\n",
  ];
  return md.join("");
}

async function mdWarningOutput(msg: string, options: JupyterToMarkdownOptions) {
  return await mdOutputStream({
    output_type: "stream",
    name: "stderr",
    text: [msg],
  }, options);
}

function isWarningOutput(output: JupyterOutput) {
  if (output.output_type === "stream") {
    const stream = output as JupyterOutputStream;
    return stream.name === "stderr";
  } else {
    return false;
  }
}

function outputTypeCssClass(output_type: string) {
  if (["display_data", "execute_result"].includes(output_type)) {
    output_type = "display";
  }
  return `cell-output-${output_type}`;
}
