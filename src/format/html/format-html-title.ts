/*
* format-html-title.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { existsSync } from "fs/mod.ts";
import { dirname, isAbsolute, join } from "path/mod.ts";
import { kDateFormat, kTocLocation } from "../../config/constants.ts";
import { Format, Metadata, PandocFlags } from "../../config/types.ts";
import { Document } from "../../core/deno-dom.ts";
import { formatResourcePath } from "../../core/resources.ts";
import { sassLayer } from "../../core/sass.ts";
import { TempContext } from "../../core/temp-types.ts";
import {
  MarkdownPipeline,
} from "../../project/types/website/website-pipeline-md.ts";

const kTitleBlockStyle = "title-block-style";
const kTitleBlockBanner = "title-block-banner";
const ktitleBlockColor = "title-block-banner-color";
const kTitleBlockCategories = "title-block-categories";

export interface DocumentTitleContext {
  pipeline: MarkdownPipeline;
}

export function documentTitleScssLayer(format: Format) {
  if (
    format.metadata[kTitleBlockStyle] === false ||
    format.metadata[kTitleBlockStyle] === "none" ||
    format.metadata[kTitleBlockStyle] === "plain"
  ) {
    return undefined;
  } else {
    const titleBlockScss = formatResourcePath(
      "html",
      join("templates", "title-block.scss"),
    );
    return sassLayer(titleBlockScss);
  }
}

export function documentTitleMetadata(
  format: Format,
) {
  if (
    format.metadata[kTitleBlockStyle] !== false &&
    format.metadata[kTitleBlockStyle] !== "none" &&
    format.metadata[kDateFormat] === undefined
  ) {
    return {
      [kDateFormat]: "long",
    };
  } else {
    return undefined;
  }
}

export function documentTitleIncludeInHeader(
  input: string,
  format: Format,
  temp: TempContext,
) {
  // Inject variables
  const variables: string[] = [];
  const banner = format.metadata[kTitleBlockBanner] as string | boolean;
  if (banner) {
    // $title-banner-bg
    // $title-banner-color
    // $title-banner-image
    const titleBlockColor = titleColor(format.metadata[ktitleBlockColor]);
    if (titleBlockColor) {
      variables.push(`color: ${titleBlockColor};`);
    }

    if (banner === true) {
      // The default appearance, use navbar color
    } else if (isBannerImage(input, banner)) {
      // An image background
      variables.push(`background-image: url(${banner});`);
      variables.push(`background-size: cover;`);
    } else {
      variables.push(`background: ${banner};`);
    }
  }

  if (variables.length > 0) {
    const styles = `<style>
    .quarto-title-block .quarto-title-banner {
      ${variables.join("\n")}
    }
    </style>`;
    const file = temp.createFile({ suffix: ".css" });
    Deno.writeTextFileSync(file, styles);
    return file;
  } else {
    return undefined;
  }
}

export function documentTitlePartial(
  format: Format,
) {
  if (
    format.metadata[kTitleBlockStyle] === false ||
    format.metadata[kTitleBlockStyle] === "none"
  ) {
    return {
      partials: [],
      templateParams: {},
    };
  } else {
    const partials = [];
    const templateParams: Metadata = {};

    // Note whether we should be showing categories
    templateParams[kTitleBlockCategories] =
      format.metadata[kTitleBlockCategories] !== false ? "true" : "";

    // Select the appropriate title block partial (banner vs no banner)
    const banner = format.metadata[kTitleBlockBanner] as string | boolean;
    if (banner) {
      partials.push("banner/title-block.html");
    } else {
      partials.push("title-block.html");
    }
    partials.push("title-metadata.html");

    // For banner partials, configure the options and pass them along in the metadata
    if (banner) {
      // When the toc is on the left, be sure to add the special grid notation
      const tocLeft = format.metadata[kTocLocation] === "left";
      if (tocLeft) {
        templateParams["banner-header-class"] = "toc-left";
      }
    }

    return {
      partials: partials.map((partial) => {
        return formatResourcePath("html", join("templates", partial));
      }),
      templateParams,
    };
  }
}

export function processDocumentTitle(
  input: string,
  format: Format,
  _flags: PandocFlags,
  doc: Document,
) {
  const resources: string[] = [];

  // when in banner mode, note on the main content region and
  // add any image to resources
  const banner = format.metadata[kTitleBlockBanner] as string | boolean;
  if (banner) {
    // Move the header above the content
    const headerEl = doc.getElementById("title-block-header");
    const contentEl = doc.getElementById("quarto-content");
    if (contentEl && headerEl) {
      headerEl.remove();
      contentEl.parentElement?.insertBefore(headerEl, contentEl);
    }

    const mainEl = doc.querySelector("main.content");
    mainEl?.classList.add("quarto-banner-title-block");

    if (isBannerImage(input, banner)) {
      resources.push(banner as string);
    }
  }

  return resources;
}

function isBannerImage(input: string, banner: unknown) {
  if (typeof (banner) === "string") {
    let path;

    if (isAbsolute(banner)) {
      path = banner;
    } else {
      path = join(dirname(input), banner);
    }
    return existsSync(path);
  } else {
    return false;
  }
}

const titleColor = (block: unknown) => {
  if (block === "body" || block === "body-bg") {
    return undefined;
  } else {
    return block;
  }
};

const _titleColorClass = (block: unknown) => {
  if (block === "body") {
    return "body";
  } else if (block === "body-bg" || block === undefined) {
    return "body-bg";
  } else {
    return "none";
  }
};
