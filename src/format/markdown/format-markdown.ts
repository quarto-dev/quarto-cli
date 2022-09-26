/*
* format-markdown.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { kOutputDivs, kVariant } from "../../config/constants.ts";
import { Format } from "../../config/types.ts";
import { createFormat, plaintextFormat } from "../formats-shared.ts";

export const kGfmCommonmarkVariant =
  "+autolink_bare_uris+emoji+footnotes+gfm_auto_identifiers" +
  "+pipe_tables+raw_html+strikeout+task_lists+tex_math_dollars-yaml_metadata_block";

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
      [kVariant]: "gfm",
    },
  });
}

export function commonmarkFormat(to: string) {
  // implement 'md' alias for commonmark
  if (to === "md") {
    to = "commonmark";
  }
  return createFormat("md", markdownFormat(), {
    pandoc: {
      to,
    },
    render: {
      [kVariant]: "-yaml_metadata_block",
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
