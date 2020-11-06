/*
* tags.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
* Unless you have received this program directly from RStudio pursuant
* to the terms of a commercial license agreement with RStudio, then
* this program is licensed to you under the terms of version 3 of the
* GNU General Public License. This program is distributed WITHOUT
* ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
* MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
* GPL (http://www.gnu.org/licenses/gpl-3.0.txt) for more details.
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
import { FormatCell } from "../../config/format.ts";

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

export function convertVisibilityTags(tags: string[] | undefined) {
  if (tags) {
    const replaceTag = (from: string, to: string) => {
      const idx = tags.indexOf(from);
      if (idx !== -1) {
        tags[idx] = to;
      }
    };
    replaceTag(kHideCell, kRemoveCell);
    replaceTag(kHideCode, kRemoveCode);
    replaceTag(kHideOutput, kRemoveOutput);
    replaceTag(kHideWarnings, kRemoveWarnings);
    replaceTag(kShowCode, kIncludeCode);
    replaceTag(kShowOutput, kIncludeOutput);
    replaceTag(kShowWarnings, kIncludeWarnings);
    return tags;
  } else {
    return tags;
  }
}

export function hideCell(cell: JupyterCell) {
  return hasTag(cell, kHideCellTags);
}

export function hideCode(cell: JupyterCell, formatCell: FormatCell) {
  return shouldHide(
    cell,
    !formatCell[kShowCode],
    kHideCodeTags,
    kShowCodeTags,
  );
}

export function hideOutput(cell: JupyterCell, formatCell: FormatCell) {
  return shouldHide(
    cell,
    !formatCell[kShowOutput],
    kHideOutputTags,
    kShowOutputTags,
  );
}

export function hideWarnings(cell: JupyterCell, formatCell: FormatCell) {
  return shouldHide(
    cell,
    !formatCell[kShowWarnings],
    kHideWarningsTags,
    kShowWarningsTags,
  );
}

export function includeCell(cell: JupyterCell) {
  return !hasTag(cell, kRemoveCellTags);
}

export function includeCode(cell: JupyterCell, formatCell: FormatCell) {
  return shouldInclude(
    cell,
    formatCell,
    kShowCode,
    kIncludeCodeTags,
    kRemoveCodeTags,
  );
}

export function includeOutput(cell: JupyterCell, formatCell: FormatCell) {
  return shouldInclude(
    cell,
    formatCell,
    kShowOutput,
    kIncludeOutputTags,
    kRemoveOutputTags,
  );
}

export function includeWarnings(cell: JupyterCell, formatCell: FormatCell) {
  return shouldInclude(
    cell,
    formatCell,
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
  formatCell: FormatCell,
  context: "show-code" | "show-output" | "show-warnings",
  includeTags: string[],
  removeTags: string[],
) {
  const includeDefault = formatCell[kKeepHidden] || formatCell[context];
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
