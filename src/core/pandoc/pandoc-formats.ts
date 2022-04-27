/*
 * pandoc-formats.ts
 *
 * Copyright (C) 2020 by RStudio, PBC
 *
 */
import { extname } from "path/mod.ts";
import {
  getBuiltInFormatAliases,
  getFormatAliases,
} from "../lib/yaml-schema/format-aliases.ts";
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

// Format strings are of the form:
// baseName+<variants | modifiers>-<variants>[<extension>]
// Where modifiers and variants can be in any order
// and basename must start the string and extension must end the string
export const parseFormatString = (formatStr: string): FormatDescriptor => {
  // acm-pdf+foo
  // gfm-raw_html
  // acm-2023-pdf+foobar
  // pdf
  // acm
  // acm-gfm-raw_html <-- not allowed

  // Try breaking the format string as a format without an extension
  const formatDesc = breakFormatString(formatStr);
  if (formatDesc) {
    return formatDesc;
  } else {
    // Split off th string after the last '-' and try to use that
    const splitFormat = formatStr.split(/-/);
    const lastEl = splitFormat.pop();
    if (lastEl) {
      const lastElFormatDesc = breakFormatString(lastEl);
      if (lastElFormatDesc) {
        // The last element was a valid format string, so
        // use the prefix parts as the extension name
        lastElFormatDesc.extension = splitFormat.join("-");
        return lastElFormatDesc;
      } else {
        // The last element wasn't a valid format string
        // This is invalid!
        throw new Error("Invalid format string");
      }
    } else {
      throw new Error("Invalid format string");
    }
  }
};

function isBuiltInFormat(format: string) {
  // Allow either a built in format or a path to a LUA file
  return getBuiltInFormatAliases().includes(format) ||
    extname(format) === ".lua";
}

function breakFormatString(formatStr: string): FormatDescriptor | undefined {
  const firstEl = formatStr.split(/[+-]/)[0];
  if (isBuiltInFormat(firstEl)) {
    // Grab anything that could be a variant
    const variantMatches = formatStr.matchAll(/[\+\-]\S*?(?=\-|\+|$)/g);
    const variantCommands: string[] = [];
    for (const match of variantMatches) {
      variantCommands.push(match[0]);
    }

    // Group the items into variants and modifiers
    // variants are valid markdown variants
    // modifiers are gmail style `+` syntax to allow the same base format
    // to be used with varying options (e.g. pdf+draft, pdf+final)
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
      baseFormat: firstEl,
      variants,
      modifiers,
      formatWithVariants: `${firstEl}${variants.join("")}`,
    };
  } else {
    return undefined;
  }
}

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
