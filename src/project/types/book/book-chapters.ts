import { ld } from "lodash/mod.ts";

import { PandocAttr } from "../../../core/pandoc/types.ts";

import {
  kCrossref,
  kCrossrefAppendixDelim,
  kCrossrefAppendixTitle,
  kCrossrefChapterId,
  kCrossrefChaptersAlpha,
  kDescription,
  kDoi,
  kNumberOffset,
  kNumberSections,
  kTitle,
  kToc,
} from "../../../config/constants.ts";
import { Format } from "../../../config/types.ts";
import { Metadata } from "../../../config/types.ts";

import { ProjectConfig, ProjectContext } from "../../types.ts";

import { bookConfigRenderItems, kBookItemAppendix } from "./book-config.ts";
import { bookConfig } from "./book-shared.ts";
import { isHtmlOutput } from "../../../config/format.ts";

export function withChapterMetadata(
  format: Format,
  headingText: string,
  headingAttr?: PandocAttr,
  chapterInfo?: ChapterInfo,
  config?: ProjectConfig,
) {
  format = ld.cloneDeep(format);
  if (headingText) {
    format.metadata[kTitle] = formatChapterTitle(
      headingText,
      format,
      chapterInfo,
    );
  }

  // make sure we have crossref metadata
  format.metadata[kCrossref] = format.metadata[kCrossref] || {};
  const crossref = format.metadata[kCrossref] as Metadata;

  // if we have an id set the chapter id
  if (headingAttr?.id) {
    crossref[kCrossrefChapterId] = headingAttr?.id;
  }

  if (chapterInfo) {
    // set offset
    format.pandoc[kNumberOffset] = [chapterInfo.number];

    // set crossref label type if this is an appendix
    if (chapterInfo.appendix) {
      crossref[kCrossrefChaptersAlpha] = true;
    }
  } else {
    format.pandoc[kNumberSections] = false;
  }

  format.pandoc[kToc] = isListedChapter(headingAttr);

  // never show doi in chapters
  delete format.metadata[kDoi];

  // forward description
  const description = bookConfig("description", config);
  if (description) {
    format.metadata[kDescription] = description;
  }
  return format;
}

export function isListedChapter(headingAttr?: PandocAttr) {
  return !headingAttr ||
    !headingAttr.classes.includes("unlisted");
}

export interface ChapterInfo {
  number: number;
  appendix: boolean;
  labelPrefix: string;
}

export function chapterInfoForInput(
  project: ProjectContext,
  chapterHref: string,
) {
  const renderItems = bookConfigRenderItems(project.config);
  const appendixPos = renderItems.findIndex((item) =>
    item.type === kBookItemAppendix
  );
  const itemPos = renderItems.findIndex((item) => item.file === chapterHref);
  if (itemPos !== -1) {
    const appendix = appendixPos !== -1 && itemPos > appendixPos;
    const item = renderItems[itemPos];
    if (item.number) {
      return {
        number: item.number,
        appendix,
        labelPrefix: appendix
          ? String.fromCharCode(64 + item.number)
          : item.number.toString(),
      };
    } else {
      return undefined;
    }
  } else {
    return undefined;
  }
}

export function formatChapterTitle(
  label: string,
  format: Format,
  info?: ChapterInfo,
) {
  if (info) {
    if (info.appendix) {
      const crossref = format.metadata?.crossref as Metadata;
      const title = crossref?.[kCrossrefAppendixTitle] || "Appendix";
      const delim = crossref?.[kCrossrefAppendixDelim] !== undefined
        ? crossref?.[kCrossrefAppendixDelim]
        : " —";
      return `${title} ${info.labelPrefix}${delim} ${label}`;
    } else {
      return `[${info.labelPrefix}]{.chapter-number-title}\u00A0 ${label}`;
    }
  } else {
    return label;
  }
}

export function formatChapterHtmlNav(label: string, info?: ChapterInfo) {
  if (info) {
    return `<span class='chapter-number'>${info.labelPrefix}</span>\u00A0 ${label}`;
  } else {
    return label;
  }
}
