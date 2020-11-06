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

import { JupyterCell } from "./jupyter.ts";

// jupyterbook/runtools: https://github.com/mwouts/jupytext/issues/337
const kIncludeCodeTags = ["include-code"];
const kIncludeOutputTags = ["include-output"];
const kIncludeWarningsTags = ["include-warnings"];
const kRemoveCodeTags = ["remove-code", "remove-input", "remove_input"];
const kRemoveOutputTags = ["remove-output", "remove_output"];
const kRemoveWarningsTags = ["remove-warnings"];
const kRemoveCellTags = ["remove-cell", "remove_cell"];

export function includeCell(cell: JupyterCell) {
  return !hasTag(cell, kRemoveCellTags);
}

export function includeCode(cell: JupyterCell, includeDefault?: boolean) {
  return shouldInclude(
    cell,
    !!includeDefault,
    kIncludeCodeTags,
    kRemoveCodeTags,
  );
}

export function includeOutput(cell: JupyterCell, includeDefault?: boolean) {
  return shouldInclude(
    cell,
    !!includeDefault,
    kIncludeOutputTags,
    kRemoveOutputTags,
  );
}

export function includeWarnings(cell: JupyterCell, includeDefault?: boolean) {
  return shouldInclude(
    cell,
    !!includeDefault,
    kIncludeWarningsTags,
    kRemoveWarningsTags,
  );
}

function shouldInclude(
  cell: JupyterCell,
  includeDefault: boolean,
  includeTags: string[],
  removeTags: string[],
) {
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
