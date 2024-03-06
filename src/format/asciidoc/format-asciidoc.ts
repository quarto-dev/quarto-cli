/*
 * format-asciidoc.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { Format } from "../../config/types.ts";

import { mergeConfigs } from "../../core/config.ts";
import { resolveInputTarget } from "../../project/project-index.ts";
import {
  BookChapterEntry,
  BookPart,
} from "../../project/types/book/book-types.ts";
import {
  bookConfig,
  bookOutputStem,
  isBookIndexPage,
} from "../../project/types/book/book-shared.ts";
import {
  kBookAppendix,
  kBookChapters,
} from "../../project/types/book/book-constants.ts";
import { join, relative } from "../../deno_ral/path.ts";

import { plaintextFormat } from "../formats-shared.ts";
import { dirAndStem } from "../../core/path.ts";
import { formatResourcePath } from "../../core/resources.ts";
import { ProjectContext } from "../../project/types.ts";
import {
  kOutputFile,
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
import { registerWriterFormatHandler } from "../format-handlers.ts";

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
      pandoc: {
        // This is required because Pandoc is wrapping asciidoc images which must be on one line
        wrap: "none",
        template: formatResourcePath(
          "asciidoc",
          join(
            "pandoc",
            "template.asciidoc",
          ),
        ),
        to: "asciidoc",
      },
      extensions: {
        book: asciidocBookExtension,
      },
    },
  );
}

const kFormatOutputDir = "book-asciidoc";
const kAsciidocDocType = "asciidoc-doctype";
const kAtlasConfigFile = "atlas.json";

// Ref target marks the refs div so the post process can inject the bibliography
const kRefTargetIdentifier = "refs-target-identifier";
const kRefTargetIndentifierValue = "// quarto-refs-target-378736AB";
const kRefTargetIndentifierMatch = /\/\/ quarto-refs-target-378736AB/g;

const kUseAsciidocNativeCites = "use-asciidoc-native-cites";

// This provide book specific behavior for producing asciidoc books
const asciidocBookExtension = {
  multiFile: true,
  formatOutputDirectory() {
    return kFormatOutputDir;
  },
  filterParams: (_options: PandocOptions) => {
    return {
      [kUseAsciidocNativeCites]: true,
      [kRefTargetIdentifier]: kRefTargetIndentifierValue,
    };
  },
  filterFormat: (source: string, format: Format, project?: ProjectContext) => {
    if (project) {
      // If this is the root index page of the book, rename the output
      const inputFile = relative(project.dir, source);
      if (isBookIndexPage(inputFile) && !format.pandoc[kOutputFile]) {
        const title = bookOutputStem(project.dir, project.config);
        const adocOutputFile = title + ".adoc";
        format.pandoc[kOutputFile] = adocOutputFile;
      }
      return format;
    } else {
      return format;
    }
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

      // Provide a doctype for the template
      format.pandoc.variables = format.pandoc.variables || {};
      format.pandoc.variables[kAsciidocDocType] = "book";

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
    const projDir = projectOutputDir(context);
    const outDir = join(projDir, kFormatOutputDir);

    // Deal with atlas.json configuration files
    // which are used by O'Reilly for configuration
    const atlasInFile = join(context.dir, kAtlasConfigFile);
    const atlasOutFile = join(outDir, kAtlasConfigFile);
    if (existsSync(atlasInFile)) {
      // See if there is an atlas.json file to move to the output
      // directory
      Deno.copyFileSync(atlasInFile, atlasOutFile);
    } else {
      // Cook up an atlas file based upon the project inputs
      // and place this in the output dir
      Deno.writeTextFileSync(atlasOutFile, project2Atlas(projDir, context));
    }

    // Find the explicit ref target
    let refsTarget;
    let indexPage;
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

function project2Atlas(projDir: string, context: ProjectContext) {
  // Cook up an atlas.json file that will be used as a placeholder
  const bookStem = bookOutputStem(projDir, context.config);
  const bookTitle = bookConfig("title", context.config);
  const atlasJson = {
    branch: "main",
    "files": [
      `${bookStem}.adoc`,
    ],
    "formats": {
      "pdf": {
        "version": "web",
        "color_count": "1",
        "index": false,
        "toc": true,
        "syntaxhighlighting": true,
        "show_comments": false,
      },
      "epub": {
        "index": false,
        "toc": true,
        "epubcheck": true,
        "syntaxhighlighting": true,
        "show_comments": false,
      },
      "mobi": {
        "index": false,
        "toc": true,
        "syntaxhighlighting": true,
        "show_comments": false,
      },
      "html": {
        "index": false,
        "toc": true,
        "syntaxhighlighting": true,
        "show_comments": false,
        "consolidated": false,
      },
    },
    "title": bookTitle,
    "compat-mode": "false",
  };
  return JSON.stringify(atlasJson, undefined, 2);
}

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

registerWriterFormatHandler((format) => {
  switch (format) {
    case "asciidoc":
    case "asciidoctor":
      return {
        format: asciidocFormat(),
      };
  }
});
