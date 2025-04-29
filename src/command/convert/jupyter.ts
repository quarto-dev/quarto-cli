/*
 * jupyter.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { stringify } from "../../core/yaml.ts";

import {
  partitionYamlFrontMatter,
  readYamlFromMarkdown,
} from "../../core/yaml.ts";
import { kCellId, kCellLabel } from "../../config/constants.ts";
import { JupyterCell, JupyterCellOptions } from "../../core/jupyter/types.ts";
import {
  jupyterAutoIdentifier,
  jupyterCellOptionsAsComment,
  jupyterCellWithOptions,
  jupyterFromFile,
  mdEnsureTrailingNewline,
  mdFromContentCell,
  mdFromRawCell,
  quartoMdToJupyter,
} from "../../core/jupyter/jupyter.ts";
import { partitionCellOptions } from "../../core/lib/partition-cell-options.ts";
import { Metadata } from "../../config/types.ts";
import { jupyterKernelspec } from "../../core/jupyter/kernels.ts";
import { fixupFrontMatter } from "../../core/jupyter/jupyter-fixups.ts";
import {
  jupyterCellSrcAsLines,
  jupyterCellSrcAsStr,
} from "../../core/jupyter/jupyter-shared.ts";
import { assert } from "testing/asserts";
import { getEndingNewlineCount } from "../../core/lib/text.ts";

export async function markdownToJupyterNotebook(
  file: string,
  includeIds: boolean,
) {
  const markdown = Deno.readTextFileSync(file);
  const notebook = await quartoMdToJupyter(markdown, includeIds);
  return JSON.stringify(notebook, null, 2);
}

export async function jupyterNotebookToMarkdown(
  file: string,
  includeIds: boolean,
) {
  // read notebook & alias kernelspec
  const notebook = fixupFrontMatter(jupyterFromFile(file));
  let kernelspec = notebook.metadata.kernelspec;

  // https://github.com/quarto-dev/quarto-cli/issues/12374
  // narrow fix for .ipynbs that have a language_info field but no kernelspec.language
  if (
    kernelspec.language === undefined && notebook.metadata.language_info?.name
  ) {
    kernelspec = {
      ...kernelspec,
      language: notebook.metadata.language_info?.name,
    };
  }
  if (kernelspec.language === undefined) {
    throw new Error(
      "No language found in kernelspec for notebook " + file,
    );
  }

  // generate markdown
  const md: string[] = [];

  let frontMatter: string | undefined;
  for (let i = 0; i < notebook.cells.length; i++) {
    {
      // alias cell
      const cell = notebook.cells[i];

      const cellWithOptions = jupyterCellWithOptions(
        i,
        kernelspec.language,
        cell,
      );

      const endingNewLineCount = getEndingNewlineCount(md);
      if (i > 0 && endingNewLineCount < 2) {
        md.push("\n\n");
      }

      // write markdown
      switch (cell.cell_type) {
        case "markdown":
          // does the previous line have enough newlines?
          // if not, add sufficient newlines so we have at least two
          // between the last cell and this one
          md.push(...mdFromContentCell(cellWithOptions));
          break;
        case "raw":
          // see if this is the front matter
          if (frontMatter === undefined) {
            const { yaml: cellYaml, markdown: cellMarkdown } =
              partitionYamlFrontMatter(
                jupyterCellSrcAsStr(cell),
              ) || {};
            if (cellYaml) {
              frontMatter = cellYaml;
            }
            if (cellMarkdown) {
              md.push(cellMarkdown);
            }
          } else {
            md.push(...mdFromRawCell(cellWithOptions));
          }

          break;
        case "code":
          md.push(
            ...(await mdFromCodeCell(
              kernelspec.language.toLowerCase(),
              cell,
              includeIds,
            )),
          );
          break;
        default:
          throw new Error("Unexpected cell type " + cell.cell_type);
      }

      // if we didn't capture frontMatter then add a newline
      if (i > 0 || !frontMatter) {
        md.push("\n");
      }
    }
  }

  // join into source
  const mdSource = md.join("");

  // read any yaml front matter defined in a 'raw' cell
  const yaml: Metadata = frontMatter ? readYamlFromMarkdown(frontMatter) : {};

  // forward qmd-relevant notebook metadata. known metadata we exclude:
  //   - toc: Jupyter UI specific metadata
  //   - language_info: Jupyter UI specific metadata
  //   - widgets: Output artifacts that don't belong in qmd source
  // for jupytext we provide a full kernelspec + jupytext metadata,
  // otherwise we provide an abbreviated spec w/ just the kernel name
  yaml.jupyter = notebook.metadata.jupytext
    ? {
      jupytext: notebook.metadata.jupytext,
      kernelspec: notebook.metadata.kernelspec,
    }
    : notebook.metadata.kernelspec.name;

  // if we are using the string shorthand make sure we have this kernelspec locally
  if (typeof yaml.jupyter === "string") {
    if (!await jupyterKernelspec(yaml.jupyter)) {
      yaml.jupyter = {
        kernelspec: notebook.metadata.kernelspec,
      };
    }
  }

  // if we found front matter, then the markdown source will start with enough
  // newlines for the front matter to have been detected in the first place.
  // So we only need to add newlines if there was no front matter.
  //
  // If this invariant breaks, we have a bug of some kind, so let's just assert it
  assert(frontMatter || !mdSource.match(/^\n\n/));
  const maybeYamlMdBreak = frontMatter ? "" : "\n\n";

  // return yaml + markdown
  const yamlText = stringify(yaml, {
    indent: 2,
    lineWidth: -1,
    sortKeys: false,
    skipInvalid: true,
  });
  return `---\n${yamlText}---${maybeYamlMdBreak}${mdSource}`;
}

async function mdFromCodeCell(
  language: string,
  cell: JupyterCell,
  includeIds: boolean,
) {
  // redact if the cell has no source
  if (!cell.source.length) {
    return [];
  }

  // determine the largest number of backticks in the cell

  const maxBackticks = Math.max(
    ...jupyterCellSrcAsLines(cell).map((line) =>
      line.match(/^`+/g)?.[0].length || 0
    ),
    2,
  );
  const backticks = "`".repeat(maxBackticks + 1);

  // begin code cell
  const md: string[] = [backticks + "{" + language + "}\n"];

  // partition
  const { yaml, source } = await partitionCellOptions(
    language,
    jupyterCellSrcAsLines(cell),
  );
  const options = yaml ? yaml as JupyterCellOptions : {};

  if (!includeIds) {
    delete cell.id;
    delete cell.metadata["id"];
    delete cell.metadata["outputId"];
  } else {
    if (cell.id) {
      if (options[kCellLabel]) {
        const label = String(options[kCellLabel]);
        if (jupyterAutoIdentifier(label) === cell.id) {
          cell.id = undefined;
        }
      }
    }
  }

  // prepare the options for writing
  let yamlOptions: Metadata = {};
  if (cell.id) {
    yamlOptions[kCellId] = cell.id;
  }
  yamlOptions = {
    ...cell.metadata,
    ...yaml,
    ...yamlOptions,
  };

  // cell id first
  if (yamlOptions[kCellId]) {
    md.push(
      ...jupyterCellOptionsAsComment(language, { id: yamlOptions[kCellId] }),
    );
    delete yamlOptions[kCellId];
  }

  // yaml
  if (yaml) {
    const yamlOutput: Metadata = {};
    for (const key in yaml) {
      const value = yamlOptions[key];
      if (value !== undefined) {
        yamlOutput[key] = value;
        delete yamlOptions[key];
      }
    }
    md.push(...jupyterCellOptionsAsComment(language, yamlOutput));
  }

  // metadata
  const metadataOutput: Metadata = {};
  for (const key in cell.metadata) {
    const value = cell.metadata[key];
    if (value !== undefined) {
      metadataOutput[key] = value;
      delete yamlOptions[key];
    }
  }
  md.push(
    ...jupyterCellOptionsAsComment(language, metadataOutput, { flowLevel: 1 }),
  );

  // write cell code
  md.push(...mdEnsureTrailingNewline(source));

  // end code cell
  md.push(backticks + "\n");

  return md;
}
