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
import { join, relative } from "path/mod.ts";

import { plaintextFormat } from "../formats-shared.ts";
import { dirAndStem } from "../../core/path.ts";
import { formatResourcePath } from "../../core/resources.ts";
import { ProjectContext } from "../../project/types.ts";
import {
  kSectionTitleReferences,
  kShiftHeadingLevelBy,
} from "../../config/constants.ts";
import { existsSync } from "fs/mod.ts";
import { ProjectOutputFile } from "../../project/types/types.ts";
import { lines } from "../../core/text.ts";
import {
  bookBibliography,
  generateBibliography,
} from "../../project/types/book/book-bibliography.ts";
import { citeIndex } from "../../project/project-cites.ts";
import { projectOutputDir } from "../../project/project-shared.ts";
import { PandocOptions } from "../../command/render/types.ts";

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
const kRefTargetIndentifierMatch = /\/\/ quarto-refs-target-378736AB/g;

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
  async bookPostRender(
    format: Format,
    context: ProjectContext,
    _incremental: boolean,
    outputFiles: ProjectOutputFile[],
  ) {
    // Find the explicit ref target
    let refsTarget;
    let indexPage;
    const projDir = projectOutputDir(context);
    const outDir = join(projDir, kFormatOutputDir);
    for (const outputFile of outputFiles) {
      const path = outputFile.file;
      if (existsSync(path)) {
        const contents = Deno.readTextFileSync(path);
        if (contents.match(kRefTargetIndentifierMatch)) {
          refsTarget = path;
        }
      }
      const relativePath = relative(outDir, outputFile.file);
      if (isBookIndexPage(relativePath)) {
        indexPage = outputFile.file;
      }
    }

    // If there is a refs target, then generate the bibliography and
    // replace the refs target with the rendered references
    //
    // If not, just append the bibliography to the index page itself
    if (refsTarget || indexPage) {
      // Read the cites
      const cites: Set<string> = new Set();

      const citeIndexObj = citeIndex(context.dir);
      for (const key of Object.keys(citeIndexObj)) {
        const citeArr = citeIndexObj[key];
        citeArr.forEach((cite) => {
          cites.add(cite);
        });
      }

      // Generate the bibliograp context for this document
      const biblio = await bookBibliography(outputFiles, context);

      // Add explicitl added cites via nocite
      if (biblio.nocite) {
        biblio.nocite.forEach((no) => {
          cites.add(no);
        });
      }

      // Generate the bibliography
      let bibliographyContents = "";
      if (biblio.bibliographyPaths && cites.size) {
        bibliographyContents = await generateBibliography(
          context,
          biblio.bibliographyPaths,
          Array.from(cites),
          "asciidoc",
          biblio.csl,
        );
      }

      // Clean the generated bibliography
      // - remove the leading `refs` indicator
      // - make the bibliography an unordered list
      // see https://docs.asciidoctor.org/asciidoc/latest/sections/bibliography/
      const cleanedBibliography = lines(bibliographyContents).filter(
        (line) => {
          return line !== "[[refs]]";
        },
      ).map((line) => {
        if (line.startsWith("[[ref-")) {
          return line.replace("[[ref-", "- [[");
        } else {
          return `  ${line}`;
        }
      }).join("\n").trim();

      if (refsTarget) {
        // Replace the refs target with the bibliography (or empty to remove it)
        const refTargetContents = Deno.readTextFileSync(refsTarget);
        const updatedContents = refTargetContents.replace(
          kRefTargetIndentifierMatch,
          cleanedBibliography,
        );
        Deno.writeTextFileSync(
          refsTarget,
          updatedContents,
        );
      } else if (indexPage) {
        const title = format.language[kSectionTitleReferences] || "References";
        const titleAdoc = `== ${title}`;

        const indexPageContents = Deno.readTextFileSync(indexPage);
        const updatedContents =
          `${indexPageContents}\n\n${titleAdoc}\n\n[[refs]]\n\n${cleanedBibliography}`;
        Deno.writeTextFileSync(
          indexPage,
          updatedContents,
        );
      }
    }
  },
};

async function bookRootPageMarkdown(project: ProjectContext) {
  // Read the chapter and appendix inputs
  const chapters = await chapterInputs(project);
  const appendices = await appendixInputs(project);

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

async function chapterInputs(project: ProjectContext) {
  const bookContents = bookConfig(
    kBookChapters,
    project.config,
  ) as BookChapterEntry[];

  // Find chapter and appendices
  return await resolveBookInputs(
    bookContents,
    project,
    (input: string) => {
      // Exclude the index page from the chapter list (since we'll append
      // this to the index page contents)
      return !isBookIndexPage(input);
    },
  );
}

async function appendixInputs(project: ProjectContext) {
  const bookApps = bookConfig(
    kBookAppendix,
    project.config,
  ) as string[];
  return bookApps
    ? await resolveBookInputs(
      bookApps,
      project,
    )
    : [];
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
