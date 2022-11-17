/*
* tags.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { kEcho, kInclude, kOutput, kWarning } from "../../config/constants.ts";

import { JupyterCellWithOptions, JupyterToMarkdownOptions } from "./types.ts";

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

export function echoFenced(
  cell: JupyterCellWithOptions,
  options: JupyterToMarkdownOptions,
) {
  const fenced = cell.options.echo === "fenced" ||
    (cell.options.echo === undefined && options.execute.echo === "fenced");
  return fenced;
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
