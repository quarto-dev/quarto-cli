/*
 * jupyter-shared.ts
 *
 * Copyright (C) 2020-2023 Posit Software, PBC
 */

import { stringify } from "../yaml.ts";
import { warning } from "../../deno_ral/log.ts";

import { kTitle } from "../../config/constants.ts";
import { Metadata } from "../../config/types.ts";
import { lines } from "../lib/text.ts";
import { markdownWithExtractedHeading } from "../pandoc/pandoc-partition.ts";
import { partitionYamlFrontMatter, readYamlFromMarkdown } from "../yaml.ts";
import { JupyterNotebook, JupyterOutput } from "./types.ts";
import {
  jupyterCellSrcAsLines,
  jupyterCellSrcAsStr,
} from "./jupyter-shared.ts";

export function fixupStreams(nb: JupyterNotebook): JupyterNotebook {
  for (const cell of nb.cells) {
    if (cell.cell_type !== "code" || cell.outputs === undefined) {
      continue;
    }
    if (cell.outputs.length === 0) {
      continue;
    }
    const newOutputs: JupyterOutput[] = [cell.outputs[0]];
    let i = 1;
    while (i < cell.outputs.length) {
      const prevOutput: JupyterOutput = newOutputs[newOutputs.length - 1];
      const thisOutput: JupyterOutput = cell.outputs[i];
      if (
        thisOutput.output_type === "stream" &&
        prevOutput.output_type === "stream" &&
        thisOutput.name === prevOutput.name
      ) {
        prevOutput.text = [...prevOutput.text ?? [], ...thisOutput.text ?? []];
      } else {
        newOutputs.push(thisOutput);
      }
      i++;
    }
    cell.outputs = newOutputs;
  }
  return nb;
}

export function fixupBokehCells(nb: JupyterNotebook): JupyterNotebook {
  for (const cell of nb.cells) {
    if (cell.cell_type === "code") {
      let needsFixup = false;
      for (const output of cell?.outputs ?? []) {
        if (output.data === undefined) {
          continue;
        }
        if (output.data["application/vnd.bokehjs_load.v0+json"]) {
          needsFixup = true;
        }
      }

      if (!needsFixup) {
        continue;
      }
      const asTextHtml = (data: Record<string, unknown>) => {
        if (data["text/html"]) {
          return data["text/html"];
        }
        if (data["application/javascript"]) {
          return [
            "<script>",
            ...data["application/javascript"] as string[],
            "</script>",
          ];
        }
        warning(
          "jupyter-fixups: unknown data types " +
            JSON.stringify(Object.keys(data)),
        );
        warning("will not fixup this bokeh cell.");
        throw new Error("");
      };

      // bokeh emits one 'initialization' cell once per notebook,
      // and then two cells per plot. So we merge the three first cells into
      // one, and then merge every two cells after that.
      //
      // Some .ipynb files in the wild have application/vnd.bokehjs_load.v0+json type
      // but cells with no outputs, so we need to check
      // and only do this fixup if these outputs exist
      //
      // We'll just be extra defensive and only do this if it runs with
      // no errors.

      try {
        const oldOutputs = cell.outputs!;

        const newOutputs: JupyterOutput[] = [
          {
            metadata: {},
            output_type: "display_data",
            data: {
              "text/html": [
                asTextHtml(oldOutputs[0].data!),
                asTextHtml(oldOutputs[1].data!),
                asTextHtml(oldOutputs[2].data!),
              ].flat(),
            },
          },
        ];
        for (let i = 3; i < oldOutputs.length; i += 2) {
          newOutputs.push({
            metadata: {},
            output_type: "display_data",
            data: {
              "text/html": [
                asTextHtml(oldOutputs[i].data!),
                asTextHtml(oldOutputs[i + 1].data!),
              ].flat(),
            },
          });
        }
        cell.outputs = newOutputs;
      } catch {
        warning(
          "jupyter-fixup: cells without output data. Will not fixup bokeh cell",
        );
      }
    }
  }

  return nb;
}

// helper to generate yaml
export function asYamlText(yaml: Metadata) {
  return stringify(yaml, {
    indent: 2,
    lineWidth: -1,
    sortKeys: false,
    skipInvalid: true,
  });
}

export function fixupFrontMatter(nb: JupyterNotebook): JupyterNotebook {
  // helper to create nb lines (w/ newline after)
  const nbLines = (lns: string[]) => {
    return lns.map((line) => line.endsWith("\n") ? line : `${line}\n`);
  };

  // look for the first raw block that has a yaml object
  let partitioned: { yaml: string; markdown: string } | undefined;
  const frontMatterCellIndex = nb.cells.findIndex((cell) => {
    if (cell.cell_type === "raw" || cell.cell_type === "markdown") {
      partitioned = partitionYamlFrontMatter(jupyterCellSrcAsStr(cell)) ||
        undefined;
      if (partitioned) {
        cell.cell_type = "raw";
        return true;
      } else {
        return false;
      }
    }
  });

  // if we have front matter and a title then we are done
  const yaml = partitioned ? readYamlFromMarkdown(partitioned.yaml) : undefined;
  if (yaml?.title) {
    return nb;
  }

  // Check the first non-front matter (or front matter cell)
  // for a heading that could be snipped out
  let title: string | undefined;
  let currentCellIdx = 0;
  for (const cell of nb.cells) {
    if (cell.cell_type === "markdown") {
      const { lines, headingText, contentBeforeHeading } =
        markdownWithExtractedHeading(
          nbLines(jupyterCellSrcAsLines(cell)).join(""),
        );
      if (headingText && !contentBeforeHeading) {
        title = headingText;
        cell.source = nbLines(lines);
        break;
      } else if (currentCellIdx !== frontMatterCellIndex) {
        break;
      }
    }
    currentCellIdx++;
  }

  // if there is no title then we are done (the doc will have no title)
  if (!title) {
    return nb;
  }

  // if we have yaml then inject the title into the cell
  if (yaml) {
    // new yaml text with title
    yaml[kTitle] = title;
    const yamlText = asYamlText(yaml);

    // re-write cell
    const frontMatterCell = nb.cells[frontMatterCellIndex];
    frontMatterCell.source = nbLines(
      lines(`---\n${yamlText}---\n\n${partitioned?.markdown || ""}`),
    );

    // otherwise inject a new cell at the top
  } else {
    const yamlText = asYamlText({ title });
    nb.cells.unshift({
      cell_type: "raw",
      source: nbLines(lines(`---\n${yamlText}---\n`)),
      metadata: {},
    });
  }

  // return modified nb
  return nb;
}

type JupyterFixup = (nb: JupyterNotebook) => JupyterNotebook;

export const defaultFixups: JupyterFixup[] = [
  fixupBokehCells,
  fixupFrontMatter,
  fixupStreams,
];

export const minimalFixups: JupyterFixup[] = [
  fixupBokehCells,
  fixupStreams,
];

// books can't have the front matter fixup
export const bookFixups: JupyterFixup[] = minimalFixups;

export function fixupJupyterNotebook(
  nb: JupyterNotebook,
  fixups: JupyterFixup[] | "minimal" | "default",
): JupyterNotebook {
  let nbFixups: JupyterFixup[] | undefined;
  if (fixups === "minimal") {
    nbFixups = minimalFixups;
  } else if (fixups === "default") {
    nbFixups = defaultFixups;
  } else {
    nbFixups = fixups;
  }
  for (const fixup of nbFixups) {
    nb = fixup(nb);
  }
  return nb;
}
