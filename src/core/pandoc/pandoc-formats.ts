/*
 * pandoc-formats.ts
 *
 * Copyright (C) 2020 by RStudio, PBC
 *
 */
import { execProcess } from "../process.ts";
import { pandocBinaryPath } from "../resources.ts";
import { lines } from "../text.ts";

export async function pandocListFormats() {
  const result = await execProcess({
    cmd: [pandocBinaryPath(), "--list-output-formats"],
    stdout: "piped",
  });
  if (result.success) {
    return lines(result.stdout!)
      .filter((line) => line.length > 0);
  } else {
    return Promise.reject();
  }
}

export function pandocFormatWith(
  format: string,
  prepend: string,
  append: string,
) {
  const split = splitPandocFormatString(format);
  return `${split.format}${prepend}${split.options}${append}`;
}

export function splitPandocFormatString(format: string) {
  // split out base format from options
  let optionsPos = format.indexOf("-");
  if (optionsPos === -1) {
    optionsPos = format.indexOf("+");
  }
  const base = optionsPos === -1 ? format : format.substr(0, optionsPos);
  const options = optionsPos === -1 ? "" : format.substr(optionsPos);
  return {
    format: base,
    options,
  };
}

export interface FormatDescriptor {
  // The core base format
  baseFormat: string;

  // +/- markdown variants that are recognized
  variants: string[];

  // +modifiers that are in the format
  modifiers: string[];

  // The format extension (e.g. format: pdf[aspa])
  extension?: string;

  // Format with extension and modifiers removed (variants only)
  formatWithVariants: string;
}

const extensionRegex = /\[(\S*)\]$/;

// Format strings are of the form:
// baseName+<variants | modifiers>-<variants>[<extension>]
// Where modifiers and variants can be in any order
// and basename must start the string and extension must end the string
export const parseFormatString = (formatStr: string): FormatDescriptor => {
  // Parse the extension ouf of the string
  const extensionMatch = formatStr.match(extensionRegex);
  let extension;
  if (extensionMatch) {
    extension = extensionMatch[1];
    formatStr = formatStr.replace(extensionRegex, "");
  }

  // Parse the base format out of the string
  const baseFormat = formatStr.split(/[+-]/)[0];

  // Grab anything that could be a variant
  const variantMatches = formatStr.matchAll(/[\+\-]\S*?(?=\-|\+|$)/g);
  const variantCommands: string[] = [];
  for (const match of variantMatches) {
    variantCommands.push(match[0]);
  }

  const variants: string[] = [];
  const modifiers: string[] = [];
  variantCommands.forEach((cmd) => {
    if (pandocVariants.includes(cmd)) {
      variants.push(cmd);
    } else {
      modifiers.push(cmd);
    }
  });

  return {
    baseFormat,
    variants,
    modifiers,
    extension,
    formatWithVariants: `${baseFormat}${variants.join("")}`,
  };
};

const pandocVariants = [
  "-abbreviations",
  "+all_symbols_escapable",
  "-amuse",
  "-angle_brackets_escapable",
  "-ascii_identifiers",
  "-attributes",
  "+auto_identifiers",
  "-autolink_bare_uris",
  "+backtick_code_blocks",
  "+blank_before_blockquote",
  "+blank_before_header",
  "+bracketed_spans",
  "+citations",
  "-compact_definition_lists",
  "+definition_lists",
  "-east_asian_line_breaks",
  "-element_citations",
  "-emoji",
  "-empty_paragraphs",
  "-epub_html_exts",
  "+escaped_line_breaks",
  "+example_lists",
  "+fancy_lists",
  "+fenced_code_attributes",
  "+fenced_code_blocks",
  "+fenced_divs",
  "+footnotes",
  "-four_space_rule",
  "-gfm_auto_identifiers",
  "+grid_tables",
  "-gutenberg",
  "-hard_line_breaks",
  "+header_attributes",
  "-ignore_line_breaks",
  "+implicit_figures",
  "+implicit_header_references",
  "+inline_code_attributes",
  "+inline_notes",
  "+intraword_underscores",
  "+latex_macros",
  "+line_blocks",
  "+link_attributes",
  "-lists_without_preceding_blankline",
  "-literate_haskell",
  "-markdown_attribute",
  "+markdown_in_html_blocks",
  "-mmd_header_identifiers",
  "-mmd_link_attributes",
  "-mmd_title_block",
  "+multiline_tables",
  "+native_divs",
  "+native_spans",
  "-native_numbering",
  "-ntb",
  "-old_dashes",
  "+pandoc_title_block",
  "+pipe_tables",
  "+raw_attribute",
  "+raw_html",
  "+raw_tex",
  "-raw_markdown",
  "-rebase_relative_paths",
  "-short_subsuperscripts",
  "+shortcut_reference_links",
  "+simple_tables",
  "+smart",
  "-sourcepos",
  "+space_in_atx_header",
  "-spaced_reference_links",
  "+startnum",
  "+strikeout",
  "+subscript",
  "+superscript",
  "-styles",
  "+task_lists",
  "+table_captions",
  "+tex_math_dollars",
  "-tex_math_double_backslash",
  "-tex_math_single_backslash",
  "-xrefs_name",
  "-xrefs_number",
  "+yaml_metadata_block",
];
