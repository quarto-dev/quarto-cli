/*
* format-asciidoc.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { Format } from "../../config/types.ts";

import { mergeConfigs } from "../../core/config.ts";
import { resolveInputTarget } from "../../project/project-index.ts";
import {
  BookChapterEntry,
  BookPart,
  kBookAppendix,
  kBookChapters,
} from "../../project/types/book/book-config.ts";
import {
  bookConfig,
  isBookIndexPage,
} from "../../project/types/book/book-shared.ts";
import { join } from "path/mod.ts";

import { plaintextFormat } from "../formats-shared.ts";
import { dirAndStem } from "../../core/path.ts";
import { formatResourcePath } from "../../core/resources.ts";
import { ProjectContext } from "../../project/types.ts";
import { kShiftHeadingLevelBy } from "../../config/constants.ts";

type AsciiDocBookPart = string | {
  partPath?: string;
  part?: string;
  chapters: string[];
};

// Provide the basic asciidoc format
export function asciidocFormat(): Format {
  return mergeConfigs(
    plaintextFormat("Asciidoc", "adoc"),
    {
      extensions: {
        book: asciidocBookExtension,
      },
    },
  );
}

const kFormatOutputDir = "asciidoc";

// Ref target marks the refs div so the post process can inject the bibliography
const kRefTargetIdentifier = "refs-target-identifier";
const kRefTargetIndentifierValue = "// quarto-refs-target-378736AB";
const kUseAsciidocNativeCites = "use-asciidoc-native-cites";

// This provide book specific behavior for producing asciidoc books
const asciidocBookExtension = {
  multiFile: true,
  formatOutputDirectory(_format: Format) {
    return kFormatOutputDir;
  },
  filterParams: (_options: PandocOptions) => {
    return {
      [kUseAsciidocNativeCites]: true,
      [kRefTargetIdentifier]: kRefTargetIndentifierValue,
    };
  },
  async onMultiFilePrePrender(
    isIndex: boolean,
    format: Format,
    markdown: string,
    project: ProjectContext,
  ) {
    if (isIndex) {
      // Generate additional markdown to include in the
      // index page
      const rootPageMd = await bookRootPageMarkdown(project);
      const completeMd = markdown + "\n" + rootPageMd;

      // Use a book specific template for the book
      format.pandoc.template = formatResourcePath(
        "asciidoc",
        join(
          "templates",
          "book",
          "template.asciidoc",
        ),
      );
      return { markdown: completeMd, format };
    } else {
      // Turn off the TOC on child pages
      format.pandoc.toc = false;
      format.pandoc[kShiftHeadingLevelBy] = -1;
      return { format };
    }
  },
  async bookPostProcess(_format: Format, _project: ProjectContext) {
  },
};

async function bookRootPageMarkdown(project: ProjectContext) {
  const bookContents = bookConfig(
    kBookChapters,
    project.config,
  ) as BookChapterEntry[];

  // Find chapter and appendices
  const chapters = await resolveBookInputs(
    bookContents,
    project,
    (input: string) => {
      // Exclude the index page from the chapter list (since we'll append
      // this to the index page contents)
      return !isBookIndexPage(input);
    },
  );

  const bookApps = bookConfig(
    kBookAppendix,
    project.config,
  ) as string[];
  const appendices = bookApps
    ? await resolveBookInputs(
      bookApps,
      project,
    )
    : [];

  // Write a book asciidoc file
  const fileContents = [
    "\n```{=asciidoc}\n\n",
    levelOffset("+1"),
    partsAndChapters(chapters, chapter),
    partsAndChapters(appendices, appendix),
    levelOffset("-1"),
    "```\n",
  ];

  return fileContents.join("\n");
}

function levelOffset(offset: string) {
  return `:leveloffset: ${offset}\n`;
}

function partsAndChapters(
  entries: AsciiDocBookPart[],
  include: (path: string) => string,
) {
  return entries.map((entry) => {
    if (typeof (entry) === "string") {
      return include(entry);
    } else {
      const partOutput: string[] = [];

      if (entry.partPath) {
        partOutput.push(include(entry.partPath));
      } else {
        partOutput.push(levelOffset("-1"));
        partOutput.push(`= ${entry.part}`);
        partOutput.push(levelOffset("+1"));
      }

      for (const chap of entry.chapters) {
        partOutput.push(include(chap));
      }

      return partOutput.join("\n");
    }
  }).join("\n");
}

function chapter(path: string) {
  return `include::${path}[]\n`;
}

function appendix(path: string) {
  return `[appendix]\n${chapter(path)}\n`;
}

async function resolveBookInputs(
  inputs: BookChapterEntry[],
  project: ProjectContext,
  filter?: (input: string) => boolean,
) {
  const resolveChapter = async (input: string) => {
    if (filter && !filter(input)) {
      return undefined;
    } else {
      const target = await resolveInputTarget(
        project,
        input,
        false,
      );
      if (target) {
        const [dir, stem] = dirAndStem(target?.outputHref);
        const outputFile = join(
          dir,
          `${stem}.adoc`,
        );

        return outputFile;
      } else {
        return undefined;
      }
    }
  };

  const outputs: AsciiDocBookPart[] = [];
  for (const input of inputs) {
    if (typeof (input) === "string") {
      const chapterOutput = await resolveChapter(input);
      if (chapterOutput) {
        outputs.push(chapterOutput);
      }
    } else {
      const entry = input as BookPart;

      const resolvedPart = await resolveChapter(entry.part);
      const entryOutput = {
        partPath: resolvedPart,
        part: resolvedPart ? undefined : entry.part,
        chapters: [] as string[],
      };
      for (const chapter of entry.chapters) {
        const resolved = await resolveChapter(chapter);
        if (resolved) {
          entryOutput.chapters.push(resolved);
        }
      }
      outputs.push(entryOutput);
    }
  }
  return outputs;
}
