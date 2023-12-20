/*
 * format-markdown.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { kFrom, kOutputDivs, kToc, kVariant } from "../../config/constants.ts";
import { Format, PandocFlags } from "../../config/types.ts";
import { pandocFormat } from "../../core/pandoc/pandoc-formats.ts";
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
    resolveFormat: (format: Format) => {
      if (format.pandoc[kToc] === true) {
        // we need to add gfm_auto_identifiers to reader otherwise ids for toc are not valid
        // see https://github.com/quarto-dev/quarto-cli/issues/4917 and
        // https://github.com/jgm/pandoc/issues/8709
        format.pandoc[kFrom] = pandocFormat(
          format.pandoc[kFrom] || "markdown",
          ["gfm_auto_identifiers"],
          [],
        );
      }
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

export const kDoCiteStuff = "do-cite-stuff";

export function markdownFormat(displayName: string): Format {
  return createFormat(displayName, "md", plaintextFormat(displayName, "md"), {
    // markdown shouldn't include cell divs (even if it
    // technically supports raw html)
    render: {
      [kOutputDivs]: false,
    },
    formatExtras: (
      _input: string,
      _markdown: string,
      _flags: PandocFlags,
      format: Format,
    ) => {
      const postprocessors: Array<(output: string) => void> = [];
      if (format.metadata[kDoCiteStuff]) {
        postprocessors.push((output: string) => {
          // DO STUFF TO CITES
        });
      }
      return {
        postprocessors,
      };
    },
  });
}
