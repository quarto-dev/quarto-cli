/*
* format-asciidoc.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { Format } from "../../config/types.ts";

import { mergeConfigs } from "../../core/config.ts";
import { resolveInputTarget } from "../../project/project-index.ts";
import { projectFormatOutputDir } from "../../project/project-shared.ts";
import { kProjectType, ProjectContext } from "../../project/types.ts";
import {
  kBookAppendix,
  kBookChapters,
} from "../../project/types/book/book-config.ts";
import {
  bookConfig,
  isBookIndexPage,
} from "../../project/types/book/book-shared.ts";
import { projectType } from "../../project/types/project-types.ts";
import { join } from "path/mod.ts";

import { plaintextFormat } from "../formats-shared.ts";
import { dirAndStem } from "../../core/path.ts";
import { formatResourcePath } from "../../core/resources.ts";

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

// This provide book specific behavior for producing asciidoc books
const asciidocBookExtension = {
  multiFile: true,
  formatOutputDirectory(_format: Format) {
    return "asciidoc";
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
    }
    return { format };
  },
  async bookPostProcess(_format: Format, _project: ProjectContext) {
  },
};

async function bookRootPageMarkdown(project: ProjectContext) {
  // Find chapter and appendices
  const chapters = await resolveBookInputs(
    bookConfig(
      kBookChapters,
      project.config,
    ) as string[],
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
    include(chapters),
    appendix(appendices),
    levelOffset("-1"),
    "```\n",
  ];

  return fileContents.join("\n");
}

function levelOffset(offset: string) {
  return `:leveloffset: ${offset}\n`;
}

function include(chapters: string[]) {
  return chapters.map((chap) => {
    return `include::${chap}[]\n`;
  }).join("\n");
}

function appendix(apps: string[]) {
  if (apps.length > 0) {
    return apps.map((app) => {
      return `[appendix]\ninclude::${app}[]\n`;
    }).join("\n");
  } else {
    return "";
  }
}

async function resolveBookInputs(
  inputs: string[],
  project: ProjectContext,
  filter?: (input: string) => boolean,
) {
  const outputs: string[] = [];
  for (const input of inputs) {
    if (filter && !filter(input)) {
      continue;
    }
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

      outputs.push(outputFile);
    }
  }
  return outputs;
}
