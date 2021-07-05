import { ld } from "lodash/mod.ts";

import { PartitionedMarkdown } from "../../../core/pandoc/pandoc-partition.ts";

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
import { Format } from "../../../config/format.ts";
import { Metadata } from "../../../config/metadata.ts";

import { ProjectConfig, ProjectContext } from "../../project-shared.ts";

import {
  bookConfig,
  bookConfigRenderItems,
  kBookItemAppendix,
} from "./book-config.ts";

export function withChapterMetadata(
  format: Format,
  partitioned: PartitionedMarkdown,
  chapterInfo?: ChapterInfo,
  config?: ProjectConfig,
) {
  format = ld.cloneDeep(format);
  if (partitioned.headingText) {
    format.metadata[kTitle] = formatChapterTitle(
      partitioned.headingText,
      format,
      chapterInfo,
    );
  }

  // make sure we have crossref metadata
  format.metadata[kCrossref] = format.metadata[kCrossref] || {};
  const crossref = format.metadata[kCrossref] as Metadata;

  // if we have an id set the chapter id
  if (partitioned.headingAttr?.id) {
    crossref[kCrossrefChapterId] = partitioned.headingAttr?.id;
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

  format.pandoc[kToc] = isListedChapter(partitioned);

  // never show doi in chapters
  delete format.metadata[kDoi];

  // forward description
  const description = bookConfig("description", config);
  if (description) {
    format.metadata[kDescription] = description;
  }

  return format;
}

export function isListedChapter(partitioned: PartitionedMarkdown) {
  return !partitioned.headingAttr ||
    !partitioned.headingAttr.classes.includes("unlisted");
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
      return `${info.labelPrefix}\u00A0 ${label}`;
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
