/*
* tags.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { kEcho, kInclude, kOutput, kWarning } from "../../config/constants.ts";

import { JupyterCellWithOptions, JupyterToMarkdownOptions } from "./jupyter.ts";

export function hideCell(
  cell: JupyterCellWithOptions,
  options: JupyterToMarkdownOptions,
) {
  return shouldHide(cell, options, kInclude);
}

export function hideCode(
  cell: JupyterCellWithOptions,
  options: JupyterToMarkdownOptions,
) {
  return shouldHide(cell, options, kEcho);
}

export function hideOutput(
  cell: JupyterCellWithOptions,
  options: JupyterToMarkdownOptions,
) {
  return shouldHide(cell, options, kOutput);
}

export function hideWarnings(
  cell: JupyterCellWithOptions,
  options: JupyterToMarkdownOptions,
) {
  // if global output is false and local output is true then we
  // should hide warnings
  if (options.execute[kOutput] === false && cell.options[kOutput] !== false) {
    return cell.options[kWarning] || false;
  } else {
    return shouldHide(cell, options, kWarning);
  }
}

export function includeCell(
  cell: JupyterCellWithOptions,
  options: JupyterToMarkdownOptions,
) {
  return shouldInclude(
    cell,
    options,
    kInclude,
  );
}

export function includeCode(
  cell: JupyterCellWithOptions,
  options: JupyterToMarkdownOptions,
) {
  return shouldInclude(
    cell,
    options,
    kEcho,
  );
}

export function includeOutput(
  cell: JupyterCellWithOptions,
  options: JupyterToMarkdownOptions,
) {
  return shouldInclude(
    cell,
    options,
    kOutput,
  );
}

export function includeWarnings(
  cell: JupyterCellWithOptions,
  options: JupyterToMarkdownOptions,
) {
  // if global output is false and local output is true then we shouldn't include warnings
  if (options.execute[kOutput] === false && cell.options[kOutput] !== false) {
    return cell.options[kWarning] || false;
  } else {
    return shouldInclude(
      cell,
      options,
      kWarning,
    );
  }
}

function shouldHide(
  cell: JupyterCellWithOptions,
  options: JupyterToMarkdownOptions,
  context: "echo" | "output" | "warning" | "include",
) {
  if (cell.options[context] !== undefined) {
    return !cell.options[context] && options.keepHidden;
  } else {
    return !options.execute[context] && options.keepHidden;
  }
}

function shouldInclude(
  cell: JupyterCellWithOptions,
  options: JupyterToMarkdownOptions,
  context: "echo" | "output" | "warning" | "include",
) {
  if (cell.options[context] !== undefined) {
    return !!(cell.options[context] || options.keepHidden);
  } else {
    return !!(options.execute[context] || options.keepHidden);
  }
}
