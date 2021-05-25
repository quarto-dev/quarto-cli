/*
* convert.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { stringify } from "encoding/yaml.ts";

import {
  partitionYamlFrontMatter,
  readYamlFromMarkdown,
} from "../../core/yaml.ts";
import {
  jupyterAutoIdentifier,
  jupyterCellOptionsAsComment,
  JupyterCellWithOptions,
  jupyterCellWithOptions,
  jupyterFromFile,
  kCellId,
  kCellLabel,
  mdEnsureTrailingNewline,
  mdFromContentCell,
  mdFromRawCell,
  quartoMdToJupyter,
} from "../../core/jupyter/jupyter.ts";
import { cellLabelValidator } from "../../core/jupyter/labels.ts";

export async function convertMarkdownToNotebook(
  file: string,
  includeIds: boolean,
) {
  const notebook = await quartoMdToJupyter(file, includeIds);
  return JSON.stringify(notebook, null, 2);
}

export function convertNotebookToMarkdown(file: string, includeIds: boolean) {
  // read notebook & alias kernelspec
  const notebook = jupyterFromFile(file);
  const kernelspec = notebook.metadata.kernelspec;

  // generate markdown
  const md: string[] = [];

  // validate unique cell labels as we go
  const validateCellLabel = cellLabelValidator();

  for (let i = 0; i < notebook.cells.length; i++) {
    {
      // convert cell yaml to cell metadata
      const cell = jupyterCellWithOptions(
        kernelspec.language,
        notebook.cells[i],
      );

      // validate unique cell labels
      validateCellLabel(cell);

      // write markdown
      switch (cell.cell_type) {
        case "markdown":
          md.push(...mdFromContentCell(cell));
          break;
        case "raw":
          md.push(...mdFromRawCell(cell));
          break;
        case "code":
          md.push(...mdFromCodeCell(kernelspec.language, cell, includeIds));
          break;
        default:
          throw new Error("Unexpected cell type " + cell.cell_type);
      }
    }
  }

  // join into source
  const mdSource = md.join("");

  // add jupyter kernelspec to front-matter
  const partitioned = partitionYamlFrontMatter(mdSource);
  if (partitioned?.yaml) {
    const yaml = readYamlFromMarkdown(partitioned.yaml);
    yaml.jupyter = notebook.metadata;
    const yamlText = stringify(yaml, {
      indent: 2,
      sortKeys: false,
      skipInvalid: true,
    });
    return `---\n${yamlText}---\n${partitioned.markdown}\n`;
  } else {
    return mdSource;
  }
}

function mdFromCodeCell(
  language: string,
  cell: JupyterCellWithOptions,
  includeIds: boolean,
) {
  // redact if the cell has no source
  if (!cell.source.length) {
    return [];
  }

  // begin code cell
  const md: string[] = ["```{" + language + "}\n"];

  // remove the id if requested or if it matches what would be auto-generated from the label
  if (cell.options[kCellId]) {
    if (!includeIds) {
      delete cell.options[kCellId];
    } else if (cell.options[kCellLabel]) {
      const label = String(cell.options[kCellLabel]);
      if (jupyterAutoIdentifier(label) === cell.options[kCellId]) {
        delete cell.options[kCellId];
      }
    }
  }

  // write cell options
  if (Object.keys(cell.options).length > 0) {
    const yamlOptions = jupyterCellOptionsAsComment(language, cell.options);
    md.push(...yamlOptions);
  }

  // write cell code
  md.push(...mdEnsureTrailingNewline(cell.source));

  // end code cell
  md.push("```\n");

  return md;
}
