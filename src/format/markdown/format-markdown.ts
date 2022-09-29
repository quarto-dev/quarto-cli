/*
* format-markdown.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { kOutputDivs, kVariant } from "../../config/constants.ts";
import { Format } from "../../config/types.ts";
import { createFormat, plaintextFormat } from "../formats-shared.ts";

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

export function requiresShortcodeUnescapePostprocessor(markdown: string) {
  return markdown.includes("{{{<");
}

export function shortcodeUnescapePostprocessor(output: string): Promise<void> {
  // unescape shortcodes
  Deno.writeTextFileSync(
    output,
    Deno.readTextFileSync(output)
      .replaceAll("{{\\<", "{{<")
      .replaceAll("\\>}}", ">}}"),
  );
  return Promise.resolve();
}

export function gfmFormat(): Format {
  return createFormat("md", markdownFormat(), {
    pandoc: {
      to: "commonmark",
    },
    render: {
      [kVariant]: kGfmCommonmarkVariant,
    },
  });
}

// for 'md' alias
export function markdownWithCommonmarkExtensionsFormat() {
  return createFormat("md", markdownFormat(), {
    pandoc: {
      to: [
        "markdown_strict",
        "+raw_html",
        "+all_symbols_escapable",
        "+backtick_code_blocks",
        "+fenced_code_blocks",
        "+space_in_atx_header",
        "+intraword_underscores",
        "+lists_without_preceding_blankline",
        "+shortcut_reference_links",
      ].join(""),
    },
  });
}

export function commonmarkFormat(to: string) {
  return createFormat("md", markdownFormat(), {
    pandoc: {
      to,
    },
  });
}

export function pandocMarkdownFormat(): Format {
  return createFormat("md", plaintextFormat("md"), {});
}

export function markdownFormat(): Format {
  return createFormat("md", plaintextFormat("md"), {
    // markdown shouldn't include cell divs (even if it
    // technically supports raw html)
    render: {
      [kOutputDivs]: false,
    },
  });
}
