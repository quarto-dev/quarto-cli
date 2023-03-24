/*
 * format-markdown.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { kOutputDivs, kVariant } from "../../config/constants.ts";
import { Format } from "../../config/types.ts";
import { createFormat, plaintextFormat } from "../formats-shared.ts";
import { kGfmCommonmarkVariant } from "./format-markdown-consts.ts";

export function requiresShortcodeUnescapePostprocessor(markdown: string) {
  return markdown.includes("{{{<");
}

const kDisplayNameGFM = "Github (GFM)";
const kDisplayNameCommonMark = "CommonMark";
const kDisplayNameMarkdown = "Markdown";

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
  return createFormat(kDisplayNameGFM, "md", markdownFormat(kDisplayNameGFM), {
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
  return createFormat(
    kDisplayNameCommonMark,
    "md",
    markdownFormat(kDisplayNameCommonMark),
    {
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
    },
  );
}

export function commonmarkFormat(to: string) {
  return createFormat(
    kDisplayNameCommonMark,
    "md",
    markdownFormat(kDisplayNameCommonMark),
    {
      pandoc: {
        to,
      },
    },
  );
}

export function pandocMarkdownFormat(): Format {
  return createFormat(
    kDisplayNameMarkdown,
    "md",
    plaintextFormat(kDisplayNameMarkdown, "md"),
    {},
  );
}

export function markdownFormat(displayName: string): Format {
  return createFormat(displayName, "md", plaintextFormat(displayName, "md"), {
    // markdown shouldn't include cell divs (even if it
    // technically supports raw html)
    render: {
      [kOutputDivs]: false,
    },
  });
}
