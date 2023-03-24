/*
 * format-markdown.ts
 *
 * Copyright (C) 2020-2023 Posit Software, PBC
 */

export const kGfmCommonmarkExtensions = [
  "+autolink_bare_uris",
  "+emoji",
  "+footnotes",
  "+gfm_auto_identifiers",
  "+pipe_tables",
  "+strikeout",
  "+task_lists",
  "+tex_math_dollars",
];

export const kGfmCommonmarkVariant = kGfmCommonmarkExtensions.join("");

export const kGfmCommonmarkFormat = `commonmark${kGfmCommonmarkVariant}`;
