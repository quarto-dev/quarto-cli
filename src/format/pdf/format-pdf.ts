/*
 * format-pdf.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { basename, extname, join } from "path/mod.ts";

import { mergeConfigs } from "../../core/config.ts";
import { texSafeFilename } from "../../core/tex.ts";

import {
  kBibliography,
  kCapBottom,
  kCapLoc,
  kCapTop,
  kCitationLocation,
  kCiteMethod,
  kClassOption,
  kDefaultImageExtension,
  kDocumentClass,
  kEcho,
  kFigCapLoc,
  kFigDpi,
  kFigFormat,
  kFigHeight,
  kFigWidth,
  kHeaderIncludes,
  kKeepTex,
  kLang,
  kNumberSections,
  kPaperSize,
  kPdfEngine,
  kReferenceLocation,
  kShiftHeadingLevelBy,
  kTblCapLoc,
  kTopLevelDivision,
  kWarning,
} from "../../config/constants.ts";
import { Format, FormatExtras, PandocFlags } from "../../config/types.ts";

import { createFormat } from "../formats-shared.ts";

import { RenderedFile, RenderServices } from "../../command/render/types.ts";
import { ProjectConfig, ProjectContext } from "../../project/types.ts";
import { BookExtension } from "../../project/types/book/book-shared.ts";

import { readLines } from "io/read_lines.ts";
import { TempContext } from "../../core/temp.ts";
import { isLatexPdfEngine, pdfEngine } from "../../config/pdf.ts";
import { formatResourcePath } from "../../core/resources.ts";
import { kTemplatePartials } from "../../command/render/template.ts";
import { copyTo } from "../../core/copy.ts";
import { kCodeAnnotations } from "../html/format-html-shared.ts";

export function pdfFormat(): Format {
  return mergeConfigs(
    createPdfFormat("PDF"),
    {
      extensions: {
        book: pdfBookExtension,
      },
    },
  );
}

export function beamerFormat(): Format {
  return createFormat(
    "Beamer",
    "pdf",
    createPdfFormat("Beamer", false, false),
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

export function latexFormat(displayName: string): Format {
  return createFormat(
    displayName,
    "tex",
    mergeConfigs(
      createPdfFormat(displayName),
      {
        extensions: {
          book: {
            onSingleFilePreRender: (
              format: Format,
              _config?: ProjectConfig,
            ) => {
              // If we're targeting LaTeX output, be sure to keep
              // the supporting files around (since we're not building
              // them into a PDF)
              format.render[kKeepTex] = true;
              return format;
            },
            formatOutputDirectory: () => {
              return "book-latex";
            },
          },
        },
      },
    ),
  );
}

function createPdfFormat(
  displayName: string,
  autoShiftHeadings = true,
  koma = true,
): Format {
  return createFormat(
    displayName,
    "pdf",
    {
      execute: {
        [kFigWidth]: 5.5,
        [kFigHeight]: 3.5,
        [kFigFormat]: "pdf",
        [kFigDpi]: 300,
      },
      pandoc: {
        [kPdfEngine]: "xelatex",
        standalone: true,
        variables: {
          graphics: true,
          tables: true,
        },
        [kDefaultImageExtension]: "pdf",
      },
      metadata: {
        ["block-headings"]: true,
      },
      formatExtras: (
        _input: string,
        markdown: string,
        flags: PandocFlags,
        format: Format,
        _libDir: string,
        services: RenderServices,
      ) => {
        const extras: FormatExtras = {};

        // only apply extras if this is latex (as opposed to context)
        const engine = pdfEngine(format.pandoc, format.render, flags);
        if (!isLatexPdfEngine(engine)) {
          return extras;
        }

        // Post processed for dealing with latex output
        extras.postprocessors = [
          pdfLatexPostProcessor(flags, format, services.temp),
        ];

        // user may have overridden koma, check for that here
        const documentclass = format.metadata[kDocumentClass] as
          | string
          | undefined;

        const usingCustomTemplates = format.pandoc.template !== undefined ||
          format.metadata[kTemplatePartials] !== undefined;

        if (
          usingCustomTemplates ||
          (documentclass &&
            ![
              "srcbook",
              "scrreprt",
              "scrreport",
              "scrartcl",
              "scrarticle",
            ].includes(
              documentclass,
            ))
        ) {
          koma = false;
        }

        // default to KOMA article class. we do this here rather than
        // above so that projectExtras can override us
        if (koma) {
          // determine caption options
          const captionOptions = [];
          const tblCaploc = tblCapLocation(format);
          captionOptions.push(
            tblCaploc === kCapTop ? "tableheading" : "tablesignature",
          );
          if (figCapLocation(format) === kCapTop) {
            captionOptions.push("figureheading");
          }

          // establish default class options
          const defaultClassOptions = ["DIV=11"];
          if (format.metadata[kLang] !== "de") {
            defaultClassOptions.push("numbers=noendperiod");
          }

          // determine class options (filter by options already set by the user)
          const userClassOptions = format.metadata[kClassOption] as
            | string[]
            | undefined;
          const classOptions = defaultClassOptions.filter((option) => {
            if (Array.isArray(userClassOptions)) {
              const name = option.split("=")[0];
              return !userClassOptions.some((userOption) =>
                String(userOption).startsWith(name + "=")
              );
            } else {
              return true;
            }
          });

          const headerIncludes = [];
          headerIncludes.push(
            "\\KOMAoption{captions}{" + captionOptions.join(",") + "}",
          );

          extras.metadata = {
            [kDocumentClass]: "scrartcl",
            [kClassOption]: classOptions,
            [kPaperSize]: "letter",
            [kHeaderIncludes]: headerIncludes,
          };
        }

        // Provide a custom template for this format
        const partialNames = [
          "before-bib",
          "biblio",
          "citations",
          "doc-class",
          "graphics",
          "after-body",
          "before-body",
          "pandoc",
          "tables",
          "tightlist",
          "title",
          "toc",
        ];
        extras.templateContext = {
          template: formatResourcePath("pdf", "pandoc/template.tex"),
          partials: partialNames.map((name) => {
            return formatResourcePath("pdf", `pandoc/${name}.tex`);
          }),
        };

        // Don't shift the headings if we see any H1s (we can't shift up any longer)
        const hasLevelOneHeadings = !!markdown.match(/\n^#\s.*$/gm);

        // pdfs with no other heading level oriented options get their heading level shifted by -1
        if (
          !hasLevelOneHeadings &&
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

        // pdfs with document class scrbook get number sections turned on
        // https://github.com/quarto-dev/quarto-cli/issues/2369
        extras.pandoc = extras.pandoc || {};
        if (
          documentclass === "scrbook" &&
          format.pandoc[kNumberSections] !== false &&
          flags[kNumberSections] !== false
        ) {
          extras.pandoc[kNumberSections] = true;
        }

        return extras;
      },
    },
  );
}

const pdfBookExtension: BookExtension = {
  selfContainedOutput: true,
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
type LineProcessor = (line: string) => string | undefined;

function pdfLatexPostProcessor(
  flags: PandocFlags,
  format: Format,
  temp: TempContext,
) {
  return async (output: string) => {
    const lineProcessors: LineProcessor[] = [
      sidecaptionLineProcessor(),
      calloutFloatHoldLineProcessor(),
    ];

    if (format.pandoc[kCiteMethod] === "biblatex") {
      lineProcessors.push(bibLatexBibligraphyRefsDivProcessor());
    } else if (format.pandoc[kCiteMethod] === "natbib") {
      lineProcessors.push(
        natbibBibligraphyRefsDivProcessor(
          format.metadata[kBibliography] as string[] | undefined,
        ),
      );
    }

    const marginCites = format.metadata[kCitationLocation] === "margin";
    const renderedCites = {};
    if (marginCites) {
      // Based upon the cite method, post process the file to
      // process unresolved citations
      if (format.pandoc[kCiteMethod] === "biblatex") {
        lineProcessors.push(suppressBibLatexBibliographyLineProcessor());
        lineProcessors.push(bibLatexCiteLineProcessor());
      } else if (format.pandoc[kCiteMethod] === "natbib") {
        lineProcessors.push(suppressNatbibBibliographyLineProcessor());
        lineProcessors.push(natbibCiteLineProcessor());
      } else {
        // If this is using the pandoc default citeproc, we need to
        // do a more complex processing, since it is generating raw latex
        // for the citations (not running a tool in the pdf chain to
        // generate the bibliography). As a result, we first read the
        // rendered bibliography, indexing the entring and removing it
        // from the latex, then we run a second pass where we use that index
        // to replace cites with the rendered versions.
        lineProcessors.push(
          indexAndSuppressPandocBibliography(renderedCites),
        );
      }
    }

    // Move longtable captions below if requested
    if (tblCapLocation(format) === kCapBottom) {
      lineProcessors.push(longtableBottomCaptionProcessor());
    }

    // If enabled, switch to sidenote footnotes
    if (marginRefs(flags, format)) {
      // Replace notes with side notes
      lineProcessors.push(sideNoteLineProcessor());
    }
    lineProcessors.push(captionFootnoteLineProcessor());

    if (
      format.metadata[kCodeAnnotations] as boolean !== false &&
      format.metadata[kCodeAnnotations] as string !== "none"
    ) {
      lineProcessors.push(codeAnnotationPostProcessor());
      lineProcessors.push(codeListAnnotationPostProcessor());
    }

    lineProcessors.push(tableSidenoteProcessor());

    // This is pass 1
    await processLines(output, lineProcessors, temp);

    // This is pass 2; we need these to happen after the first pass
    const pass2Processors: LineProcessor[] = [
      longTableSidenoteProcessor(),
    ];
    if (Object.keys(renderedCites).length > 0) {
      pass2Processors.push(placePandocBibliographyEntries(renderedCites));
    }
    await processLines(output, pass2Processors, temp);
  };
}

function tblCapLocation(format: Format) {
  return format.metadata[kTblCapLoc] || format.metadata[kCapLoc] || kCapTop;
}

function figCapLocation(format: Format) {
  return format.metadata[kFigCapLoc] || format.metadata[kCapLoc] || kCapBottom;
}

function marginRefs(flags: PandocFlags, format: Format) {
  return format.pandoc[kReferenceLocation] === "margin" ||
    flags[kReferenceLocation] === "margin";
}

// Processes the lines of an input file, processing each line
// and replacing the input file with the processed output file
async function processLines(
  inputFile: string,
  lineProcessors: LineProcessor[],
  temp: TempContext,
) {
  // The temp file we generate into
  const outputFile = temp.createFile({ suffix: ".tex" });
  const file = await Deno.open(inputFile);
  // Preserve the existing permissions as we'll replace
  let mode;
  if (Deno.build.os !== "windows") {
    const stat = Deno.statSync(inputFile);
    if (stat.mode !== null) {
      mode = stat.mode;
    }
  }
  try {
    for await (const line of readLines(file)) {
      let processedLine: string | undefined = line;
      // Give each processor a shot at the line
      for (const processor of lineProcessors) {
        if (processedLine !== undefined) {
          processedLine = processor(processedLine);
        }
      }

      // skip lines that a processor has 'eaten'
      if (processedLine !== undefined) {
        Deno.writeTextFileSync(outputFile, processedLine + "\n", {
          append: true,
          mode,
        });
      }
    }
  } finally {
    file.close();

    // Always overwrite the input file with an incompletely processed file
    // which should make debugging the error easier (I hope)
    copyTo(outputFile, inputFile);
  }
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

// Reads the first command encountered as a balanced command
// (e.g. \caption{...} or \footnote{...}) and returns
// the complete command
//
// This expects the latex string to start with the command
const readBalancedCommand = (latex: string) => {
  let braceCount = 0;
  let entered = false;
  const chars: string[] = [];
  for (let i = 0; i < latex.length; i++) {
    const char = latex.charAt(i);
    if (char === "{") {
      braceCount++;
      entered = true;
    } else if (char === "}") {
      braceCount--;
    }

    chars.push(char);
    if (entered && braceCount === 0) {
      break;
    }
  }
  return chars.join("");
};

// Process element caption footnotes on a latex string
// This expects a latex elements with a `\caption{}`
//
// It will extract footnotes from the caption and replace
// them with a footnote mark and position the footnote
// below the latex element (e.g. it will remove the footnote
// from the element and then return the footnote below
// the element)
const processElementCaptionFootnotes = (latexFigure: string) => {
  const footnoteMark = "\\footnote{";
  const captionMark = "\\caption{";

  // Contents holds the final contents that will be returned
  // after being joined. This function will append to contents
  // to build up the final output
  const contents: string[] = [];

  // Read up to the caption itself
  const captionIndex = latexFigure.indexOf(captionMark);
  if (captionIndex > -1) {
    // Slice off the figure up to the caption
    contents.push(latexFigure.substring(0, captionIndex));
    const captionStartStr = latexFigure.slice(captionIndex);

    // Read the caption
    const captionLatex = readBalancedCommand(captionStartStr);
    const figureSuffix = captionStartStr.slice(captionLatex.length);

    // Slice off the command prefix and suffix
    let captionContents = captionLatex.slice(
      captionMark.length,
      captionLatex.length - 1,
    );

    // Deal with footnotes in the caption
    let footNoteIndex = captionContents.indexOf(footnoteMark);
    if (footNoteIndex > -1) {
      // Caption text will not have any footnotes in it
      const captionText: string[] = [];
      // Caption with note will have footnotemarks in it
      const captionWithNote: string[] = [];
      // The footnotes that we found along the way
      const footNotes: string[] = [];
      while (footNoteIndex > -1) {
        // capture any prefix
        const prefix = captionContents.substring(0, footNoteIndex);
        captionContents = captionContents.slice(footNoteIndex);

        // push the prefix onto the captions
        captionText.push(prefix);
        captionWithNote.push(prefix);

        // process the footnote
        const footnoteLatex = readBalancedCommand(captionContents);
        captionContents = captionContents.slice(footnoteLatex.length);
        footNoteIndex = captionContents.indexOf(footnoteMark);

        // Capture the footnote and place a footnote mark in the caption
        captionWithNote.push("\\footnotemark{}");
        footNotes.push(
          footnoteLatex.slice(footnoteMark.length, footnoteLatex.length - 1),
        );
      }
      // Push any leftovers onto the caption contents
      captionText.push(captionContents);
      captionWithNote.push(captionContents);

      // push the caption onto the contents
      contents.push(
        `\\caption[${captionText.join("")}]{${captionWithNote.join("")}}`,
      );

      // push the suffix onto the contents
      contents.push(figureSuffix);

      // push the footnotes on the contents
      contents.push("\n");

      // Add a proper footnote counter offset, if necessary
      if (footNotes.length > 1) {
        contents.push(`\\addtocounter{footnote}{-${footNotes.length - 1}}`);
      }

      for (let i = 0; i < footNotes.length; i++) {
        contents.push(`\\footnotetext{${footNotes[i]}}`);
        if (footNotes.length > 1 && i < footNotes.length - 1) {
          contents.push(`\\addtocounter{footnote}{1}`);
        }
      }
      return contents.join("");
    } else {
      // No footnotes in the caption, just leave it alone
      return latexFigure;
    }
  } else {
    // No caption means just let it go
    return latexFigure;
  }
};

const captionFootnoteLineProcessor = () => {
  let state: "scanning" | "capturing" = "scanning";
  let capturedLines: string[] = [];
  return (line: string): string | undefined => {
    switch (state) {
      case "scanning":
        if (line.match(/^\\begin{figure}.*$/)) {
          state = "capturing";
          capturedLines = [line];
          return undefined;
        } else {
          return line;
        }
      case "capturing":
        capturedLines.push(line);
        if (line.match(/^\\end{figure}%*$/)) {
          state = "scanning";

          // read the whole figure and clear any capture state
          const lines = capturedLines.join("\n");
          capturedLines = [];

          // Process the captions and relocate footnotes
          return processElementCaptionFootnotes(lines);
        } else {
          return undefined;
        }
    }
  };
};

const processSideNotes = (endMarker: string) => {
  return (latexLongTable: string) => {
    const sideNoteMarker = "\\sidenote{\\footnotesize ";
    let strProcessing = latexLongTable;
    const strOutput: string[] = [];
    const sidenotes: string[] = [];

    let sidenotePos = strProcessing.indexOf(sideNoteMarker);
    while (sidenotePos > -1) {
      strOutput.push(strProcessing.substring(0, sidenotePos));

      const remainingStr = strProcessing.substring(
        sidenotePos + sideNoteMarker.length,
      );
      let escaped = false;
      let sideNoteEnd = -1;
      for (let i = 0; i < remainingStr.length; i++) {
        const ch = remainingStr[i];
        if (ch === "\\") {
          escaped = true;
        } else {
          if (!escaped && ch === "}") {
            sideNoteEnd = i;
            break;
          } else {
            escaped = false;
          }
        }
      }

      if (sideNoteEnd > -1) {
        strOutput.push("\\sidenotemark{}");
        const contents = remainingStr.substring(0, sideNoteEnd);
        sidenotes.push(contents);
        strProcessing = remainingStr.substring(sideNoteEnd + 1);
        sidenotePos = strProcessing.indexOf(sideNoteMarker);
      } else {
        strOutput.push(remainingStr);
      }
    }

    // Ensure that we inject sidenotes after the longtable
    const endTable = endMarker;
    const endPos = strProcessing.indexOf(endTable);
    const prefix = strProcessing.substring(0, endPos + endTable.length);
    const suffix = strProcessing.substring(
      endPos + endTable.length,
      strProcessing.length,
    );

    strOutput.push(prefix);
    for (const note of sidenotes) {
      strOutput.push(`\\sidenotetext{${note}}\n`);
    }
    if (suffix) {
      strOutput.push(suffix);
    }

    return strOutput.join("");
  };
};

const processLongTableSidenotes = processSideNotes("\\end{longtable}");
const processTableSidenotes = processSideNotes("\\end{table}");

const sideNoteProcessor = (
  beginRegex: RegExp,
  endRegex: RegExp,
  callback: (str: string) => string,
) => {
  return () => {
    let state: "scanning" | "capturing" = "scanning";
    let capturedLines: string[] = [];
    return (line: string): string | undefined => {
      switch (state) {
        case "scanning":
          if (line.match(beginRegex)) {
            state = "capturing";
            capturedLines = [line];
            return undefined;
          } else {
            return line;
          }
        case "capturing":
          capturedLines.push(line);
          if (line.match(endRegex)) {
            state = "scanning";

            // read the whole figure and clear any capture state
            const lines = capturedLines.join("\n");
            capturedLines = [];

            // Process the captions and relocate footnotes
            return callback(lines);
          } else {
            return undefined;
          }
      }
    };
  };
};
const longTableSidenoteProcessor = sideNoteProcessor(
  /^\\begin{longtable}.*$/,
  /^\\end{longtable}%*$/,
  processLongTableSidenotes,
);

const tableSidenoteProcessor = sideNoteProcessor(
  /^\\begin{table}.*$/,
  /^\\end{table}%*$/,
  processTableSidenotes,
);

const calloutFloatHoldLineProcessor = () => {
  let state: "scanning" | "replacing" = "scanning";
  return (line: string): string | undefined => {
    switch (state) {
      case "scanning":
        if (line.match(/^\\begin{tcolorbox}/)) {
          state = "replacing";
          return line;
        } else {
          return line;
        }

      case "replacing":
        if (line.match(/^\\end{tcolorbox}/)) {
          state = "scanning";
          return line;
        } else if (line.match(/^\\begin{figure}$/)) {
          return "\\begin{figure}[H]";
        } else if (line.match(/^\\begin{codelisting}$/)) {
          return "\\begin{codelisting}[H]";
        } else {
          return line;
        }
    }
  };
};

const kQuartoBibPlaceholderRegex = "%bib-loc-124C8010";
const bibLatexBibligraphyRefsDivProcessor = () => {
  let hasRefsDiv = false;
  return (line: string): string | undefined => {
    if (line === kQuartoBibPlaceholderRegex) {
      if (!hasRefsDiv) {
        hasRefsDiv = true;
        return "\\printbibliography[heading=none]";
      } else {
        // already seen a refs div, just ignore this one
        return undefined;
      }
    } else if (hasRefsDiv && line.match(/^\\printbibliography$/)) {
      return undefined;
    } else {
      return line;
    }
  };
};

const natbibBibligraphyRefsDivProcessor = (bibs?: string[]) => {
  let hasRefsDiv = false;
  return (line: string): string | undefined => {
    if (line === kQuartoBibPlaceholderRegex) {
      if (bibs && !hasRefsDiv) {
        hasRefsDiv = true;
        return `\\renewcommand{\\bibsection}{}\n\\bibliography{${
          bibs.join(",")
        }}`;
      } else {
        // already seen a refs div, just ignore this one
        return undefined;
      }
    } else if (hasRefsDiv && line.match(/^\s*\\bibliography{.*}$/)) {
      return undefined;
    } else {
      return line;
    }
  };
};

// Removes the biblatex \printbibiliography command
const suppressBibLatexBibliographyLineProcessor = () => {
  return (line: string): string | undefined => {
    if (line.match(/^\\printbibliography$/)) {
      return "";
    }
    return line;
  };
};

// Replaces the natbib bibligography declaration with a version
// that will not be printed in the PDF
const suppressNatbibBibliographyLineProcessor = () => {
  return (line: string): string | undefined => {
    return line.replace(/^\s*\\bibliography{(.*)}$/, (_match, bib) => {
      return `\\newsavebox\\mytempbib
\\savebox\\mytempbib{\\parbox{\\textwidth}{\\bibliography{${bib}}}}`;
    });
  };
};

// {?quarto-cite:(id)}
const kQuartoCiteRegex = /{\?quarto-cite:(.*?)}/g;
const bibLatexCiteLineProcessor = () => {
  return (line: string): string | undefined => {
    return line.replaceAll(kQuartoCiteRegex, (_match, citeKey) => {
      return `\\fullcite{${citeKey}}`;
    });
  };
};

const natbibCiteLineProcessor = () => {
  return (line: string): string | undefined => {
    return line.replaceAll(kQuartoCiteRegex, (_match, citeKey) => {
      return `\\bibentry{${citeKey}}`;
    });
  };
};

const sideNoteLineProcessor = () => {
  return (line: string): string | undefined => {
    return line.replaceAll(/\\footnote{/g, "\\sidenote{\\footnotesize ");
  };
};

const longtableBottomCaptionProcessor = () => {
  let scanning = false;
  let capturing = false;
  let caption: string | undefined;

  return (line: string): string | undefined => {
    const isEndOfDocument = !!line.match(/^\\end{document}/);
    if (isEndOfDocument && caption) {
      return `${caption}\n${line}`;
    } else if (scanning) {
      // look for a caption line
      if (capturing) {
        caption = `${caption}\n${line}`;
        capturing = !line.match(/\\tabularnewline$/);
        return undefined;
      } else {
        if (
          line.match(/^\\caption.*?\\tabularnewline$/) ||
          line.match(/^\\caption{.*}\\\\$/)
        ) {
          caption = line;
          return undefined;
        } else if (line.match(/^\\caption.*?/)) {
          caption = line;
          capturing = true;
          return undefined;
        } else if (line.match(/^\\end{longtable}$/)) {
          scanning = false;
          if (caption) {
            line = caption + "\n" + line;
            caption = undefined;
            return line;
          }
        }
      }
    } else {
      scanning = !!line.match(/^\\begin{longtable}/);
    }

    return line;
  };
};

const indexAndSuppressPandocBibliography = (
  renderedCites: Record<string, string[]>,
) => {
  let consuming = false;
  let currentCiteKey: string | undefined = undefined;

  return (line: string): string | undefined => {
    if (!consuming && line.match(/^\\hypertarget{refs}{}$/)) {
      consuming = true;
      return undefined;
    } else if (consuming && line.match(/^\\end{CSLReferences}$/)) {
      consuming = false;
      return undefined;
    } else if (consuming) {
      const matches = line.match(/pre{\\hypertarget{ref\-(.*?)}{}}\%/);
      if (matches && matches[1]) {
        currentCiteKey = matches[1];

        // protect the hypertarget command and the save this line
        // protect is useful if the reference appears in a caption
        renderedCites[currentCiteKey] = [
          line.replace(
            "pre{\\hypertarget{ref",
            "pre{\\protect\\hypertarget{ref",
          ),
        ];
      } else if (line.length === 0) {
        currentCiteKey = undefined;
      } else if (currentCiteKey) {
        renderedCites[currentCiteKey].push(line);
      }
    }

    if (consuming) {
      return undefined;
    } else {
      return line;
    }
  };
};

const placePandocBibliographyEntries = (
  renderedCites: Record<string, string[]>,
) => {
  return (line: string): string | undefined => {
    return line.replaceAll(kQuartoCiteRegex, (_match, citeKey) => {
      const citeLines = renderedCites[citeKey];
      if (citeLines) {
        return citeLines.join("\n");
      } else {
        return citeKey;
      }
    });
  };
};

const kCodeAnnotationRegex =
  /(.*)\\CommentTok\{.* \\textless\{\}(\d+)\\textgreater\{\}.*\}$/gm;
const kCodePlainAnnotationRegex = /(.*)% \((\d+)\)$/g;
const codeAnnotationPostProcessor = () => {
  let lastAnnotation: string | undefined;

  return (line: string): string | undefined => {
    if (line === "\\begin{Shaded}") {
      lastAnnotation = undefined;
    }

    // Replace colorized code
    line = line.replaceAll(
      kCodeAnnotationRegex,
      (_match, prefix: string, annotationNumber: string) => {
        if (annotationNumber !== lastAnnotation) {
          lastAnnotation = annotationNumber;
          return `${prefix}\\hspace*{\\fill}\\NormalTok{\\circled{${annotationNumber}}}`;
        } else {
          return `${prefix}`;
        }
      },
    );

    // Replace plain code
    line = line.replaceAll(
      kCodePlainAnnotationRegex,
      (_match, prefix: string, annotationNumber: string) => {
        if (annotationNumber !== lastAnnotation) {
          lastAnnotation = annotationNumber;

          const replaceValue = `(${annotationNumber})`;
          const paddingNumber = Math.max(
            0,
            75 - prefix.length - replaceValue.length,
          );
          const padding = " ".repeat(paddingNumber);
          return `${prefix}${padding}${replaceValue}`;
        } else {
          return `${prefix}`;
        }
      },
    );

    return line;
  };
};

const kListAnnotationRegex = /(.*)5CB6E08D-list-annote-(\d+)(.*)/g;
const codeListAnnotationPostProcessor = () => {
  return (line: string): string | undefined => {
    return line.replaceAll(
      kListAnnotationRegex,
      (_match, prefix: string, annotationNumber: string, suffix: string) => {
        return `${prefix}\\circled{${annotationNumber}}${suffix}`;
      },
    );
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
