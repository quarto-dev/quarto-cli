/*
 * book-chapters.ts
 *
 * Copyright (C) 2020-2023 Posit Software, PBC
 */

import * as ld from "../../../core/lodash.ts";

import { PandocAttr } from "../../../core/pandoc/types.ts";

import {
  kCrossref,
  kCrossrefAppendixDelim,
  kCrossrefAppendixTitle,
  kCrossrefApxPrefix,
  kCrossrefChapterId,
  kCrossrefChaptersAlpha,
  kCrossrefChaptersAppendix,
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

import { bookConfigRenderItems } from "./book-config.ts";
import { kBookItemAppendix } from "./book-constants.ts";
import { bookConfig } from "./book-shared.ts";

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
      format,
      headingText,
      headingAttr,
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
      crossref[kCrossrefChaptersAppendix] = true;
      crossref[kCrossrefChaptersAlpha] = true;
    }
  } else {
    format.pandoc[kNumberSections] = false;
  }

  format.pandoc[kToc] = format.pandoc[kToc] !== undefined
    ? format.pandoc[kToc]
    : isListedChapter(headingAttr);

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
  format: Format,
  label: string,
  attr?: PandocAttr,
  info?: ChapterInfo,
) {
  const withIdSpan = (text: string) => {
    if (!attr?.id) {
      return text;
    } else {
      return `[${text}]{#${attr.id} .quarto-section-identifier}`;
    }
  };

  if (!info) {
    return withIdSpan(label);
  }

  if (info.appendix) {
    const crossref = format.metadata?.crossref as Metadata;
    const title = crossref?.[kCrossrefAppendixTitle] ||
      format.language[kCrossrefApxPrefix] || "Appendix";
    const delim = crossref?.[kCrossrefAppendixDelim] !== undefined
      ? crossref?.[kCrossrefAppendixDelim]
      : " —";
    return withIdSpan(`${title} ${info.labelPrefix}${delim} ${label}`);
  } else {
    if (format.pandoc[kNumberSections] === false) {
      return withIdSpan(
        `[${label}]{.chapter-title}`,
      );
    } else {
      return withIdSpan(
        `[${info.labelPrefix}]{.chapter-number}\u00A0 [${label}]{.chapter-title}`,
      );
    }
  }
}

export function numberChapterHtmlNav(label: string, info?: ChapterInfo) {
  if (info) {
    return `<span class='chapter-number'>${info.labelPrefix}</span>\u00A0 <span class='chapter-title'>${label}</span>`;
  } else {
    return label;
  }
}
