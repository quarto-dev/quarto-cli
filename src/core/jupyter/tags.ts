/*
* tags.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import {
  kHideCell,
  kHideCode,
  kHideOutput,
  kHideWarnings,
  kIncludeCode,
  kIncludeOutput,
  kIncludeWarnings,
  kKeepHidden,
  kRemoveCell,
  kRemoveCode,
  kRemoveOutput,
  kRemoveWarnings,
  kShowCode,
  kShowOutput,
  kShowWarnings,
} from "../../config/constants.ts";
import { FormatExecution } from "../../config/format.ts";

import { JupyterCell } from "./jupyter.ts";

const kHideCellTags = [kHideCell];
const kHideCodeTags = [kHideCode];
const kHideOutputTags = [kHideOutput];
const kHideWarningsTags = [kHideWarnings];
const kShowCodeTags = [kShowCode];
const kShowOutputTags = [kShowOutput];
const kShowWarningsTags = [kShowWarnings];

const kIncludeCodeTags = [kIncludeCode];
const kIncludeOutputTags = [kIncludeOutput];
const kIncludeWarningsTags = [kIncludeWarnings];
const kRemoveCodeTags = [kRemoveCode];
const kRemoveOutputTags = [kRemoveOutput];
const kRemoveWarningsTags = [kRemoveWarnings];
const kRemoveCellTags = [kRemoveCell];

export function hideCell(cell: JupyterCell) {
  return hasTag(cell, kHideCellTags);
}

export function hideCode(cell: JupyterCell, execution: FormatExecution) {
  return shouldHide(
    cell,
    !execution[kShowCode],
    kHideCodeTags,
    kShowCodeTags,
  );
}

export function hideOutput(cell: JupyterCell, execution: FormatExecution) {
  return shouldHide(
    cell,
    !execution[kShowOutput],
    kHideOutputTags,
    kShowOutputTags,
  );
}

export function hideWarnings(cell: JupyterCell, execution: FormatExecution) {
  return shouldHide(
    cell,
    !execution[kShowWarnings],
    kHideWarningsTags,
    kShowWarningsTags,
  );
}

export function includeCell(cell: JupyterCell, execution: FormatExecution) {
  const removeTags = kRemoveCellTags.concat(
    !execution[kKeepHidden] ? kHideCellTags : [],
  );
  return !hasTag(cell, removeTags);
}

export function includeCode(cell: JupyterCell, execution: FormatExecution) {
  return shouldInclude(
    cell,
    execution,
    kShowCode,
    kIncludeCodeTags,
    kRemoveCodeTags,
  );
}

export function includeOutput(cell: JupyterCell, execution: FormatExecution) {
  return shouldInclude(
    cell,
    execution,
    kShowOutput,
    kIncludeOutputTags,
    kRemoveOutputTags,
  );
}

export function includeWarnings(cell: JupyterCell, execution: FormatExecution) {
  return shouldInclude(
    cell,
    execution,
    kShowWarnings,
    kIncludeWarningsTags,
    kRemoveWarningsTags,
  );
}

function shouldHide(
  cell: JupyterCell,
  hideDefault: boolean,
  hideTags: string[],
  showTags: string[],
) {
  if (hideDefault) {
    return !hasTag(cell, showTags);
  } else {
    return hasTag(cell, hideTags);
  }
}

function shouldInclude(
  cell: JupyterCell,
  execution: FormatExecution,
  context: "show-code" | "show-output" | "show-warnings",
  includeTags: string[],
  removeTags: string[],
) {
  // if we aren't keeping hidden then show == include and hide == remove
  if (!execution[kKeepHidden]) {
    switch (context) {
      case "show-code":
        includeTags = includeTags.concat(kShowCodeTags);
        removeTags = removeTags.concat(kHideCodeTags);
        break;
      case "show-output":
        includeTags = includeTags.concat(kShowOutputTags);
        removeTags = removeTags.concat(kHideOutputTags);
        break;
      case "show-warnings":
        includeTags = includeTags.concat(kShowWarningsTags);
        removeTags = removeTags.concat(kHideWarningsTags);
        break;
    }
  }
  const includeDefault = execution[kKeepHidden] || execution[context];
  if (includeDefault) {
    return !hasTag(cell, removeTags);
  } else {
    return hasTag(cell, includeTags);
  }
}

function hasTag(cell: JupyterCell, tags: string[]) {
  if (!cell.metadata.tags) {
    return false;
  }
  return cell.metadata.tags.filter((tag) => tags.includes(tag)).length > 0;
}
