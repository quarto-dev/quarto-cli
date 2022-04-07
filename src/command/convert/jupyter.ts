/*
* jupyter.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { stringify } from "encoding/yaml.ts";

import {
  partitionYamlFrontMatter,
  readYamlFromMarkdown,
} from "../../core/yaml.ts";
import { kCellId, kCellLabel } from "../../config/constants.ts";
import {
  jupyterAutoIdentifier,
  JupyterCell,
  JupyterCellOptions,
  jupyterCellOptionsAsComment,
  jupyterFromFile,
  mdEnsureTrailingNewline,
  mdFromContentCell,
  mdFromRawCell,
  quartoMdToJupyter,
} from "../../core/jupyter/jupyter.ts";
import { partitionCellOptions } from "../../core/partition-cell-options.ts";
import { Metadata } from "../../config/types.ts";
import { jupyterKernelspec } from "../../core/jupyter/kernels.ts";

export async function markdownToJupyterNotebook(
  file: string,
  includeIds: boolean,
) {
  const notebook = await quartoMdToJupyter(file, includeIds);
  return JSON.stringify(notebook, null, 2);
}

export async function jupyterNotebookToMarkdown(
  file: string,
  includeIds: boolean,
) {
  // read notebook & alias kernelspec
  const notebook = await jupyterFromFile(file);
  const kernelspec = notebook.metadata.kernelspec;

  // generate markdown
  const md: string[] = [];

  let frontMatter: string | undefined;
  for (let i = 0; i < notebook.cells.length; i++) {
    {
      // alias cell
      const cell = notebook.cells[i];

      // write markdown
      switch (cell.cell_type) {
        case "markdown":
          md.push(...mdFromContentCell(cell));
          break;
        case "raw":
          // see if this is the front matter
          if (i === 0) {
            frontMatter = partitionYamlFrontMatter(cell.source.join(""))?.yaml;
            if (!frontMatter) {
              md.push(...mdFromRawCell(cell));
            }
          } else {
            md.push(...mdFromRawCell(cell));
          }

          break;
        case "code":
          md.push(
            ...mdFromCodeCell(
              kernelspec.language.toLowerCase(),
              cell,
              includeIds,
            ),
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

  // return yaml + markdown
  const yamlText = stringify(yaml, {
    indent: 2,
    sortKeys: false,
    skipInvalid: true,
  });
  return `---\n${yamlText}---\n\n${mdSource}`;
}

function mdFromCodeCell(
  language: string,
  cell: JupyterCell,
  includeIds: boolean,
) {
  // redact if the cell has no source
  if (!cell.source.length) {
    return [];
  }

  // begin code cell
  const md: string[] = ["```{" + language + "}\n"];

  // partition
  const { yaml, source } = partitionCellOptions(language, cell.source);
  const options = yaml ? yaml as JupyterCellOptions : {};

  // handle id
  if (cell.id) {
    if (!includeIds) {
      cell.id = undefined;
    } else if (options[kCellLabel]) {
      const label = String(options[kCellLabel]);
      if (jupyterAutoIdentifier(label) === cell.id) {
        cell.id = undefined;
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
  md.push("```\n");

  return md;
}
