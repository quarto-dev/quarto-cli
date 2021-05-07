import { ld } from "lodash/mod.ts";

import { PartitionedMarkdown } from "../../../core/pandoc/pandoc-partition.ts";

import {
  kCrossref,
  kCrossrefChapterId,
  kCrossrefChaptersAlpha,
  kDescription,
  kDoi,
  kNumberOffset,
  kNumberSections,
  kTitle,
} from "../../../config/constants.ts";
import { Format } from "../../../config/format.ts";
import { Metadata } from "../../../config/metadata.ts";

import { ProjectConfig, ProjectContext } from "../../project-context.ts";

import { bookConfig, bookConfigRenderItems } from "./book-config.ts";

export function withChapterMetadata(
  format: Format,
  partitioned: PartitionedMarkdown,
  chapterInfo?: ChapterInfo,
  config?: ProjectConfig,
) {
  format = ld.cloneDeep(format);
  if (partitioned.headingText) {
    format.metadata[kTitle] = formatChapterLabel(
      partitioned.headingText,
      chapterInfo,
      false,
    );
  }

  if (chapterInfo) {
    // set offset
    format.pandoc[kNumberOffset] = [chapterInfo.number];

    // make sure we have crossref metadata
    format.metadata[kCrossref] = format.metadata[kCrossref] || {};
    const crossref = format.metadata[kCrossref] as Metadata;

    // if we have an id set the chapter id
    if (partitioned.headingAttr?.id) {
      crossref[kCrossrefChapterId] = partitioned.headingAttr?.id;
    }

    // set crossref label type if this is an appendix
    if (chapterInfo.appendix) {
      crossref[kCrossrefChaptersAlpha] = true;
      format.pandoc[kNumberSections] = false;
    }
  } else {
    format.pandoc[kNumberSections] = false;
  }

  // never show doi in chapters
  delete format.metadata[kDoi];

  // forward description
  const description = bookConfig("description", config);
  if (description) {
    format.metadata[kDescription] = description;
  }

  return format;
}

export function isNumberedChapter(partitioned: PartitionedMarkdown) {
  return !partitioned.headingAttr ||
    !partitioned.headingAttr.classes.includes("unnumbered");
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
  const appendixPos = renderItems.findIndex((item) => item.type === "appendix");
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

export function formatChapterLabel(
  label: string,
  info: ChapterInfo | undefined,
  short: boolean,
) {
  if (short || !info || !info.appendix) {
    return info
      ? `<span class='chapter-number'>${info.labelPrefix}</span>\u00A0 ${label}`
      : label;
  } else {
    return `Appendix ${info.labelPrefix} — ${label}`;
  }
}
