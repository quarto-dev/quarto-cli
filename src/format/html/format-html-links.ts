/*
 * format-html-links.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { dirname, isAbsolute, relative } from "path/mod.ts";

import {
  kDisplayName,
  kExtensionName,
  kFormatLinks,
  kTargetFormat,
} from "../../config/constants.ts";
import { Format, FormatAliasLink, FormatLink } from "../../config/types.ts";

import { RenderedFormat } from "../../command/render/types.ts";
import {
  isDocxOutput,
  isHtmlOutput,
  isIpynbOutput,
  isJatsOutput,
  isMarkdownOutput,
  isPdfOutput,
  isPresentationOutput,
  isTypstOutput,
} from "../../config/format.ts";
import { basename } from "path/mod.ts";
import { extname } from "path/mod.ts";

export interface AlternateLink {
  title: string;
  href: string;
  icon: string;
  order: number;
  dlAttrValue?: string;
  attr?: Record<string, string>;
}

export function otherFormatLinks(
  input: string,
  format: Format,
  renderedFormats: RenderedFormat[],
) {
  const normalizedFormatLinks = (
    unnormalizedLinks: unknown,
  ): Array<string | FormatLink | FormatAliasLink> | undefined => {
    if (typeof unnormalizedLinks === "boolean") {
      return undefined;
    } else if (unnormalizedLinks !== undefined) {
      const linksArr: unknown[] = Array.isArray(unnormalizedLinks)
        ? unnormalizedLinks
        : [unnormalizedLinks];
      return linksArr as Array<string | FormatLink | FormatAliasLink>;
    } else {
      return undefined;
    }
  };
  const userLinks = normalizedFormatLinks(format.render[kFormatLinks]);

  // Don't include HTML output
  const filteredFormats = renderedFormats.filter(
    (renderedFormat) => {
      return !isHtmlOutput(renderedFormat.format.pandoc, true);
    },
  );

  return alternateLinks(
    input,
    filteredFormats,
    userLinks,
  );
}

export function alternateLinks(
  input: string,
  formats: RenderedFormat[],
  userLinks?: Array<string | FormatLink | FormatAliasLink>,
): AlternateLink[] {
  const alternateLinks: AlternateLink[] = [];

  const alternateLinkForFormat = (
    renderedFormat: RenderedFormat,
    order: number,
    title?: string,
    icon?: string,
  ) => {
    const relPath = isAbsolute(renderedFormat.path)
      ? relative(dirname(input), renderedFormat.path)
      : renderedFormat.path;
    return {
      title: `${
        title ||
        renderedFormat.format.identifier[kDisplayName] ||
        renderedFormat.format.pandoc.to
      }${
        renderedFormat.format.identifier[kExtensionName]
          ? ` (${renderedFormat.format.identifier[kExtensionName]})`
          : ""
      }`,
      href: relPath,
      icon: icon || fileBsIconName(renderedFormat.format),
      order,
      dlAttrValue: fileDownloadAttr(
        renderedFormat.format,
        renderedFormat.path,
      ),
    };
  };

  let count = 1;
  for (const userLink of userLinks || []) {
    if (typeof userLink === "string") {
      // We need to filter formats, otherwise, we'll deal
      // with them below
      const renderedFormat = formats.find((f) =>
        f.format.identifier[kTargetFormat] === userLink
      );
      if (renderedFormat) {
        // Just push through
        alternateLinks.push(alternateLinkForFormat(renderedFormat, count));
      }
    } else {
      const linkObj = userLink as FormatLink | FormatAliasLink;
      if ("format" in linkObj) {
        const thatLink = userLink as FormatAliasLink;
        const rf = formats.find((f) =>
          f.format.identifier[kTargetFormat] === thatLink.format
        );
        if (rf) {
          // Just push through
          alternateLinks.push(
            alternateLinkForFormat(rf, count, thatLink.text, thatLink.icon),
          );
        }
      } else {
        // This an explicit link
        const thisLink = userLink as FormatLink;
        const alternate = {
          title: thisLink.text,
          href: thisLink.href,
          icon: thisLink.icon || fileBsIconForExt(thisLink.href),
          dlAttrValue: "",
          order: thisLink.order || count,
          attr: thisLink.attr,
        };
        alternateLinks.push(alternate);
      }
    }
    count++;
  }

  const userLinksHasFormat = userLinks &&
    userLinks.some((link) => typeof link === "string");
  if (!userLinksHasFormat) {
    formats.forEach((renderedFormat) => {
      const baseFormat = renderedFormat.format.identifier["base-format"];
      if (!kExcludeFormatUnlessExplicit.includes(baseFormat || "html")) {
        alternateLinks.push(alternateLinkForFormat(renderedFormat, count));
      }
      count++;
    });
  }

  return alternateLinks;
}

// Provides an icon for a format
const fileBsIconName = (format: Format) => {
  if (isDocxOutput(format.pandoc)) {
    return "file-word";
  } else if (isPdfOutput(format.pandoc)) {
    return "file-pdf";
  } else if (isTypstOutput(format.pandoc)) {
    return "file-pdf";
  } else if (isIpynbOutput(format.pandoc)) {
    return "journal-code";
  } else if (isMarkdownOutput(format)) {
    return "file-code";
  } else if (isPresentationOutput(format.pandoc)) {
    return "file-slides";
  } else if (isJatsOutput(format.pandoc)) {
    return "filetype-xml";
  } else {
    return "file";
  }
};

// Provides a download name for a format/path
const fileDownloadAttr = (format: Format, path: string) => {
  if (isIpynbOutput(format.pandoc)) {
    return basename(path);
  } else if (isJatsOutput(format.pandoc)) {
    return basename(path);
  } else {
    return undefined;
  }
};

const fileBsIconForExt = (path: string) => {
  const ext = extname(path);
  switch (ext.toLowerCase()) {
    case ".docx":
      return "file-word";
    case ".pdf":
      return "file-pdf";
    case ".ipynb":
      return "journal-code";
    case ".md":
      return "file-code";
    case ".xml":
      return "filetype-xml";
    default:
      return "file";
  }
};

const kExcludeFormatUnlessExplicit = ["jats"];
