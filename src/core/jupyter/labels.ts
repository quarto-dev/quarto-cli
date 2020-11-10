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
  kCellLabel,
  kCellName,
  kFigLabel,
} from "./jupyter.ts";
import { includeOutput } from "./tags.ts";

export function cellLabel(cell: JupyterCell) {
  return (cell.metadata[kCellLabel] || cell.metadata[kCellName] || "")
    .toLowerCase();
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

export function cellContainerLabel(
  cell: JupyterCell,
  options: JupyterToMarkdownOptions,
) {
  let label = cellLabel(cell);
  if (label) {
    // apply pandoc auto-identifier treatment (but allow prefix)
    label = label.replace(/(^\w+\:)?(.*)$/, (str, p1, p2) => {
      return (p1 || "") + pandocAutoIdentifier(p2, true);
    });

    // no outputs
    if (!cell.outputs) {
      return label;
    }

    // not including output
    if (!includeOutput(cell, options.execution)) {
      return label;
    }

    // no display data outputs
    const displayDataOutputs = cell.outputs.filter(isDisplayData);
    if (displayDataOutputs.length === 0) {
      return label;
    }

    // multiple display data outputs (apply to container then apply sub-labels to outputs)
    if (displayDataOutputs.length > 1) {
      // see if the outputs share a common label type, if they do then apply
      // that label type to the parent
      const labelTypes = displayDataOutputs.map((output) =>
        outputLabelType(output, options)
      );
      const labelType = labelTypes[0];
      if (labelType && labelTypes.every((type) => labelType === type)) {
        if (!label.startsWith(labelType + ":")) {
          return `${labelType}:${label}`;
        } else {
          return label;
        }
      } else {
        return label;
      }
    }

    // in the case of a single display data output, check to see if it is directly
    // targetable with a label (e.g. a figure). if it's not then just apply the
    // label to the container
    if (!outputLabelType(cell.outputs[0], options)) {
      return label;
    }

    // not targetable
    return null;
  } else {
    return null;
  }
}

// see if an output is one of our known types (e.g. 'fig')
function outputLabelType(
  output: JupyterOutput,
  options: JupyterToMarkdownOptions,
) {
  if (isDisplayData(output)) {
    const mimeType = displayDataMimeType(
      output as JupyterOutputDisplayData,
      options,
    );
    if (mimeType && displayDataIsImage(mimeType)) {
      return kFigLabel;
    }
  }
  return null;
}
