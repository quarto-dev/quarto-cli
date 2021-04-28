import { ld } from "lodash/mod.ts";

import { PartitionedMarkdown } from "../../../core/pandoc/pandoc-partition.ts";

import {
  kNumberOffset,
  kNumberSections,
  kTitle,
} from "../../../config/constants.ts";
import { Format } from "../../../config/format.ts";

import { ProjectContext } from "../../project-context.ts";

import { bookConfigRenderItems } from "./book-config.ts";

export function withChapterMetadata(
  format: Format,
  partitioned: PartitionedMarkdown,
  chapterNumber?: number,
) {
  format = ld.cloneDeep(format);
  if (partitioned.headingText) {
    format.metadata[kTitle] = formatChapterLabel(
      partitioned.headingText,
      chapterNumber,
    );
  }

  if (chapterNumber) {
    format.pandoc[kNumberOffset] = [chapterNumber];
  } else {
    format.pandoc[kNumberSections] = false;
  }

  return format;
}

export function chapterNumberForInput(
  project: ProjectContext,
  chapterHref: string,
) {
  const renderItems = bookConfigRenderItems(project.config);
  const item = renderItems.find((item) => item.file === chapterHref);
  if (item) {
    return item.number;
  } else {
    return undefined;
  }
}

export function formatChapterLabel(label: string, chapterNumber?: number) {
  return chapterNumber ? `${chapterNumber}\u00A0 ${label}` : label;
}

export function isNumberedChapter(partitioned: PartitionedMarkdown) {
  return !partitioned.headingAttr ||
    !partitioned.headingAttr.classes.includes("unnumbered");
}
