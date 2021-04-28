import { relative } from "path/mod.ts";

import { ld } from "lodash/mod.ts";

import { PartitionedMarkdown } from "../../../core/pandoc/pandoc-partition.ts";

import { kNumberOffset, kTitle } from "../../../config/constants.ts";
import { Format } from "../../../config/format.ts";

import { ProjectContext } from "../../project-context.ts";
import { inputTargetIndex } from "../../project-index.ts";

export function withChapterMetadata(
  format: Format,
  partitioned: PartitionedMarkdown,
  chapterNumber: number,
) {
  format = ld.cloneDeep(format);
  if (partitioned.headingText) {
    format.metadata[kTitle] = formatChapterLabel(
      partitioned.headingText,
      chapterNumber,
    );
  }

  format.pandoc[kNumberOffset] = [chapterNumber];
  return format;
}

export async function chapterNumberForInput(
  project: ProjectContext,
  chapterHref: string,
) {
  const chapterIndex = await inputTargetIndex(project, chapterHref);
  let chapterNumber = 0;
  if (chapterIndex && isNumberedChapter(chapterIndex?.markdown)) {
    for (const input of project.files.input) {
      const inputRelative = relative(project.dir, input);
      // found ourselves, increment then break
      if (inputRelative === chapterHref) {
        chapterNumber++;
        break;
      }
      const inputIndex = await inputTargetIndex(project, inputRelative);
      if (inputIndex) {
        // increment for numbered chapters
        if (isNumberedChapter(inputIndex?.markdown)) {
          chapterNumber++;
        }
      }
    }
  }
  return chapterNumber;
}

export function formatChapterLabel(label: string, chapterNumber: number) {
  return chapterNumber > 0 ? `${chapterNumber}\u00A0 ${label}` : label;
}

export function isNumberedChapter(partitioned: PartitionedMarkdown) {
  return !partitioned.headingAttr ||
    !partitioned.headingAttr.classes.includes("unnumbered");
}
