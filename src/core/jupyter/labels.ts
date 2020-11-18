import { pandocAutoIdentifier } from "../pandoc/pandoc_id.ts";
import {
  displayDataIsImage,
  displayDataMimeType,
  isDisplayData,
} from "./display_data.ts";

import {
  JupyterCell,
  JupyterOutput,
  JupyterOutputDisplayData,
  JupyterToMarkdownOptions,
  kCellFigCap,
  kCellFigSubCap,
  kCellLabel,
  kCellName,
} from "./jupyter.ts";
import { includeOutput } from "./tags.ts";

export function cellLabel(cell: JupyterCell) {
  const label = (cell.metadata[kCellLabel] || cell.metadata[kCellName] || "")
    .toLowerCase();
  // apply pandoc auto-identifier treatment (but allow prefix)
  return label.replace(/(^\w+\:)?(.*)$/, (str, p1, p2) => {
    return (p1 || "") + pandocAutoIdentifier(p2, true);
  });
}

// validate unique labels
export function cellLabelValidator() {
  const cellLabels = new Set<string>();
  return function (cell: JupyterCell) {
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
  cell: JupyterCell,
  options: JupyterToMarkdownOptions,
) {
  // no outputs
  if (!cell.outputs) {
    return true;
  }

  // not including output
  if (!includeOutput(cell, options.execution)) {
    return true;
  }

  // no display data outputs
  const displayDataOutputs = cell.outputs.filter(isDisplayData);
  if (displayDataOutputs.length === 0) {
    return true;
  }

  // multiple display data outputs
  if (displayDataOutputs.length > 1) {
    return true;
  }

  // don't label it (single display_data output)
  return false;
}

export function shouldLabelOutputContainer(
  output: JupyterOutput,
  options: JupyterToMarkdownOptions,
) {
  // label output container unless this is an image (which gets it's id directly assigned)
  if (isDisplayData(output)) {
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

export function resolveCaptions(cell: JupyterCell) {
  // if we have display data outputs, then break off their captions
  if (Array.isArray(cell.metadata[kCellFigCap])) {
    const figCap = cell.metadata[kCellFigCap] as string[];
    if (cell.outputs && cell.outputs.filter(isDisplayData).length > 0) {
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
  } else if (cell.metadata[kCellFigCap]) {
    if (cell.metadata[kCellFigSubCap]) {
      return {
        cellCaption: cell.metadata[kCellFigCap],
        outputCaptions: cell.metadata[kCellFigSubCap] || [],
      };
    } else {
      return {
        cellCaption: undefined,
        outputCaptions: [cell.metadata[kCellFigCap] as string],
      };
    }
  } else {
    return {
      cellCaption: undefined,
      outputCaptions: [],
    };
  }
}
