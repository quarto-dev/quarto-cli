/*
* labels.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { asHtmlId } from "../html.ts";

import {
  displayDataIsImage,
  displayDataMimeType,
  isCaptionableData,
  isDisplayData,
} from "./display-data.ts";

import {
  JupyterCellOptions,
  JupyterCellWithOptions,
  JupyterOutput,
  JupyterOutputDisplayData,
  JupyterToMarkdownOptions,
} from "./types.ts";

import {
  kCellFigCap,
  kCellFigSubCap,
  kCellLabel,
  kCellName,
} from "../../config/constants.ts";

import { includeOutput } from "./tags.ts";

export function cellLabel(cell: JupyterCellWithOptions) {
  const label = asHtmlId(
    cell.options[kCellLabel] || cell.metadata[kCellName] || "",
  );

  if (label && !label.startsWith("#")) {
    return "#" + label;
  } else {
    return label;
  }
}

// validate unique labels
export function cellLabelValidator() {
  const cellLabels = new Set<string>();
  return function (cell: JupyterCellWithOptions) {
    const label = cellLabel(cell);
    if (label) {
      if (cellLabels.has(label)) {
        throw new Error(
          "Cell label names must be unique (found duplicate '" + label + "')",
        );
      } else {
        cellLabels.add(label);
      }
    }
  };
}

export function shouldLabelCellContainer(
  cell: JupyterCellWithOptions,
  outputs: JupyterOutput[],
  options: JupyterToMarkdownOptions,
) {
  // no outputs
  if (!outputs) {
    return true;
  }

  // not including output
  if (!includeOutput(cell, options)) {
    return true;
  }

  // no display data outputs
  const displayDataOutputs = outputs.filter(isDisplayData);
  if (displayDataOutputs.length === 0) {
    return true;
  }

  // multiple display data outputs (with multiple caps)
  if (
    displayDataOutputs.length > 1 && !Array.isArray(cell.options[kCellFigCap])
  ) {
    return true;
  }

  // table label
  if (hasTableLabel(cell.options)) {
    return true;
  }

  // don't label it (single display_data output)
  return false;
}

function hasTableLabel(options: JupyterCellOptions) {
  return typeof (options[kCellLabel]) === "string" &&
    options[kCellLabel]?.startsWith("tbl-");
}

export function shouldLabelOutputContainer(
  output: JupyterOutput,
  cellOptions: JupyterCellOptions,
  options: JupyterToMarkdownOptions,
) {
  // label output container unless this is an image (which gets its ids directly assigned)
  if (isDisplayData(output)) {
    // don't label tables (lua filter will do that)
    if (hasTableLabel(cellOptions)) {
      return false;
    }

    if (!isCaptionableData(output)) {
      return false;
    }

    const mimeType = displayDataMimeType(
      output as JupyterOutputDisplayData,
      options,
    );
    if (mimeType) {
      if (displayDataIsImage(mimeType)) {
        return false;
      }
    }
    return true;
  } else {
    return false;
  }
}

export function resolveCaptions(cell: JupyterCellWithOptions) {
  // if we have display data outputs, then break off their captions
  if (Array.isArray(cell.options[kCellFigCap])) {
    const figCap = cell.options[kCellFigCap] as string[];
    if (
      cell.outputs &&
      cell.outputs.filter(isCaptionableData).length > 0
    ) {
      return {
        cellCaption: undefined,
        outputCaptions: figCap,
      };
    } else {
      return {
        cellCaption: undefined,
        outputCaptions: [],
      };
    }
  } else if (cell.options[kCellFigCap]) {
    if (cell.options[kCellFigSubCap] !== undefined) {
      let subCap = cell.options[kCellFigSubCap];
      if (subCap === true) {
        subCap = [""];
      }
      if (!Array.isArray(subCap)) {
        subCap = [String(subCap)];
      }
      return {
        cellCaption: cell.options[kCellFigCap],
        outputCaptions: subCap,
      };
    } else {
      return {
        cellCaption: undefined,
        outputCaptions: [cell.options[kCellFigCap] as string],
      };
    }
  } else {
    return {
      cellCaption: undefined,
      outputCaptions: [],
    };
  }
}
