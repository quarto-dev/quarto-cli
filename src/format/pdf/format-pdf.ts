/*
* format-pdf.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { basename, extname, join } from "path/mod.ts";

import { mergeConfigs } from "../../core/config.ts";
import { texSafeFilename } from "../../core/tex.ts";

import {
  kClassOption,
  kDocumentClass,
  kEcho,
  kFigDpi,
  kFigFormat,
  kFigHeight,
  kFigWidth,
  kKeepTex,
  kNumberSections,
  kPaperSize,
  kReferenceLocation,
  kShiftHeadingLevelBy,
  kTopLevelDivision,
  kWarning,
} from "../../config/constants.ts";
import { Format, FormatExtras, PandocFlags } from "../../config/types.ts";

import { createFormat } from "../formats-shared.ts";

import { RenderedFile } from "../../command/render/types.ts";
import { ProjectContext } from "../../project/types.ts";
import { BookExtension } from "../../project/types/book/book-shared.ts";

import { readLines } from "io/bufio.ts";
import { sessionTempFile } from "../../core/temp.ts";

export function pdfFormat(): Format {
  return mergeConfigs(
    createPdfFormat(),
    {
      extensions: {
        book: pdfBookExtension,
      },
    },
  );
}

export function beamerFormat(): Format {
  return createFormat(
    "pdf",
    createPdfFormat(false, false),
    {
      execute: {
        [kFigWidth]: 10,
        [kFigHeight]: 7,
        [kEcho]: false,
        [kWarning]: false,
      },
    },
  );
}

export function latexFormat(): Format {
  return createFormat(
    "tex",
    createPdfFormat(),
  );
}

function createPdfFormat(autoShiftHeadings = true, koma = true): Format {
  return createFormat(
    "pdf",
    {
      execute: {
        [kFigWidth]: 6.5,
        [kFigHeight]: 4.5,
        [kFigFormat]: "pdf",
        [kFigDpi]: 300,
      },
      pandoc: {
        standalone: true,
        variables: {
          graphics: true,
          tables: true,
        },
      },
      formatExtras: (_input: string, flags: PandocFlags, format: Format) => {
        const extras: FormatExtras = {};

        // Post processed for dealing with latex output
        extras.postprocessors = [pdfLatexPostProcessor(flags, format)];

        // default to KOMA article class. we do this here rather than
        // above so that projectExtras can override us
        if (koma) {
          extras.metadata = {
            [kDocumentClass]: "scrartcl",
            [kClassOption]: ["DIV=11"],
            [kPaperSize]: "letter",
          };
        }

        // pdfs with no other heading level oriented options get their heading level shifted by -1
        if (
          autoShiftHeadings &&
          (flags?.[kNumberSections] === true ||
            format.pandoc[kNumberSections] === true) &&
          flags?.[kTopLevelDivision] === undefined &&
          format.pandoc?.[kTopLevelDivision] === undefined &&
          flags?.[kShiftHeadingLevelBy] === undefined &&
          format.pandoc?.[kShiftHeadingLevelBy] === undefined
        ) {
          extras.pandoc = {
            [kShiftHeadingLevelBy]: -1,
          };
        }

        return extras;
      },
    },
  );
}

const pdfBookExtension: BookExtension = {
  onSingleFilePostRender: (
    project: ProjectContext,
    renderedFile: RenderedFile,
  ) => {
    // if we have keep-tex then rename the input tex file to match the final output
    // file (but make sure it has a tex-friendly filename)
    if (renderedFile.format.render[kKeepTex]) {
      const finalOutputFile = renderedFile.file!;
      const texOutputFile =
        texSafeFilename(basename(finalOutputFile, extname(finalOutputFile))) +
        ".tex";
      Deno.renameSync(
        join(project.dir, "index.tex"),
        join(project.dir, texOutputFile),
      );
    }
  },
};

function pdfLatexPostProcessor(flags: PandocFlags, format: Format) {
  return async (output: string) => {
    const outputProcessed = sessionTempFile({ suffix: ".tex" });
    const file = await Deno.open(output);
    try {
      const lineProcessors = [
        sidecaptionLineProcessor(),
      ];

      // If enabled, switch to sidenote footnotes
      if (
        format.pandoc[kReferenceLocation] === "gutter" ||
        flags[kReferenceLocation] === "gutter"
      ) {
        lineProcessors.push(sideNoteLineProcessor());
      }
      for await (const line of readLines(file)) {
        let processedLine: string | undefined = line;
        for (const processor of lineProcessors) {
          if (line !== undefined) {
            processedLine = processor(line);
          }
        }
        if (processedLine !== undefined) {
          Deno.writeTextFileSync(outputProcessed, processedLine + "\n", {
            append: true,
          });
        }
      }
    } finally {
      file.close();
      Deno.copyFileSync(outputProcessed, output);
    }
  };
}

const kBeginScanRegex = /^%quartopost-sidecaption-206BE349/;
const kEndScanRegex = /^%\/quartopost-sidecaption-206BE349/;

const sidecaptionLineProcessor = () => {
  let state: "scanning" | "replacing" = "scanning";
  return (line: string): string | undefined => {
    switch (state) {
      case "scanning":
        if (line.match(kBeginScanRegex)) {
          state = "replacing";
          return kbeginLongTablesideCap;
        } else {
          return line;
        }

      case "replacing":
        if (line.match(kEndScanRegex)) {
          state = "scanning";
          return kEndLongTableSideCap;
        } else {
          return line;
        }
    }
  };
};

const sideNoteLineProcessor = () => {
  return (line: string): string | undefined => {
    return line.replace(/\\footnote{/, "\\sidenote{");
  };
};

const kbeginLongTablesideCap = `{
\\makeatletter
\\def\\LT@makecaption#1#2#3{%
  \\noalign{\\smash{\\hbox{\\kern\\textwidth\\rlap{\\kern\\marginparsep
  \\parbox[t]{\\marginparwidth}{%
    \\footnotesize{%
      \\vspace{(1.1\\baselineskip)}
    #1{#2: }\\ignorespaces #3}}}}}}%
    }
\\makeatother`;

const kEndLongTableSideCap = "}";
