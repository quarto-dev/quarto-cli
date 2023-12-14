/*
 * book-crossrefs.ts
 *
 * Copyright (C) 2020-2023 Posit Software, PBC
 */

import { warning } from "log/mod.ts";
import { dirname, join, relative } from "path/mod.ts";
import { existsSync } from "fs/mod.ts";

import {
  Element,
  HTMLDocument,
  parseHtml,
  writeDomToHtmlFile,
} from "../../../core/deno-dom.ts";

import { pathWithForwardSlashes } from "../../../core/path.ts";

import {
  kCrossrefApxPrefix,
  kCrossrefChapterId,
  kCrossrefChapters,
  kCrossrefChaptersAlpha,
  kCrossrefChaptersAppendix,
  kCrossrefChPrefix,
  kCrossrefLabels,
  kCrossrefSecPrefix,
  kOutputFile,
} from "../../../config/constants.ts";
import { defaultWriterFormat } from "../../../format/formats.ts";
import { ProjectContext } from "../../types.ts";
import { projectOutputDir } from "../../project-shared.ts";
import { crossrefIndexForOutputFile } from "../../project-crossrefs.ts";
import { WebsiteProjectOutputFile } from "../website/website.ts";

import { inputTargetIndex } from "../../project-index.ts";
import { bookConfigRenderItems } from "./book-config.ts";
import { isMultiFileBookFormat } from "./book-shared.ts";
import { Format } from "../../../config/types.ts";

export async function bookCrossrefsPostRender(
  context: ProjectContext,
  outputFiles: WebsiteProjectOutputFile[],
) {
  // output dir for the project
  const projOutput = projectOutputDir(context);

  // if we have any output files that require crossref resolution
  const crossrefOutputFiles = outputFiles.filter((file) =>
    isMultiFileBookFormat(file.format)
  );
  if (crossrefOutputFiles.length > 0) {
    const indexes = await bookCrossrefIndexes(context);

    for (const outputFile of crossrefOutputFiles) {
      // get the appropriate index for this output file
      const fileRelative = relative(projOutput, outputFile.file);
      const index = bookCrossrefIndexForOutputFile(fileRelative, indexes);
      if (index) {
        // resolve crossrefs
        const doc = await parseHtml(Deno.readTextFileSync(outputFile.file));
        resolveCrossrefs(
          context,
          fileRelative,
          outputFile.format,
          doc,
          index,
        );
        writeDomToHtmlFile(doc, outputFile.file, outputFile.doctype);
      }
    }
  }
}

function resolveCrossrefs(
  context: ProjectContext,
  file: string,
  format: Format,
  doc: HTMLDocument,
  index: BookCrossrefIndex,
) {
  // record proj output (all the paths we have are proj output relative)
  const projOutput = projectOutputDir(context);

  // compute a relative file path to the current file
  const relativePathTo = (target: string) => {
    const currentFile = join(projOutput, file);
    const targetFile = join(projOutput, target);
    return pathWithForwardSlashes(
      relative(dirname(currentFile), targetFile),
    );
  };

  // find all the unresolved crossrefs
  const refs = doc.querySelectorAll(".quarto-unresolved-ref");
  for (let i = 0; i < refs.length; i++) {
    const ref = refs[i] as Element;
    const id = ref.textContent;
    const noPrefix = ref.classList.contains("ref-noprefix");
    const type = refType(id);
    if (!type) {
      continue;
    }
    const entry = index.entries[id];
    let parentLink: Element | undefined;
    if (
      ref.parentElement?.tagName === "A" &&
      ref.parentElement?.getAttribute("href") === `#${id}`
    ) {
      parentLink = ref.parentElement;
    }
    if (entry) {
      // update the link to point to the correct output file
      if (parentLink && file !== entry.file) {
        const relativeFilePath = relativePathTo(entry.file);
        const hash = isChapterRef(entry) ? "" : `#${id}`;
        parentLink.setAttribute("href", `${relativeFilePath}${hash}`);
      }

      ref.innerHTML = formatCrossref(
        type,
        index.files[entry.file],
        entry,
        noPrefix,
        format,
        entry.parent ? index.entries[entry.parent] : undefined,
      );
      ref.removeAttribute("class");
    } else {
      warning(`${file}: Unable to resolve crossref @${id}`);
      // insert error span if not found
      if (parentLink) {
        const parentLinkParent = parentLink.parentElement as Element;
        if (parentLinkParent) {
          const span = doc.createElement("span");
          span.classList.add("quarto-unresolved-ref");
          span.innerHTML = `?${id}`;
          parentLinkParent.insertBefore(span, parentLink);
          parentLink.remove();
        }
      }
    }
  }

  // fixup all heading links
  const links = doc.querySelectorAll("a");
  for (let i = 0; i < links.length; i++) {
    const link = links[i] as Element;
    const href = link.getAttribute("href");
    if (href && href.startsWith("#")) {
      // determine target file(s) for link
      const id = href.slice(1);
      if (index.headings[id]) {
        // if it's a link to another file then fix it up. if it's the chapter id
        // then just link to the file
        if (!index.headings[id].files.includes(file)) {
          const linkToFile = index.headings[id].files[0];
          const hash = index.files[linkToFile]?.[kCrossrefChapterId] === id
            ? ""
            : `#${id}`;
          const relativeFilePath = relativePathTo(index.headings[id].files[0]);
          link.setAttribute("href", `${relativeFilePath}${hash}`);
        }
      }
    }
  }
}

interface BookCrossrefIndex {
  files: { [key: string]: BookCrossrefOptions };
  entries: { [key: string]: BookCrossrefEntry };
  headings: { [id: string]: BookCrossrefHeading };
}

interface BookCrossrefOptions {
  [kCrossrefLabels]?: string;
  [kCrossrefChapters]?: boolean;
  [kCrossrefChaptersAppendix]?: boolean;
  [kCrossrefChaptersAlpha]?: boolean;
  [key: string]: string | string[] | boolean | undefined;
}

interface BookCrossrefEntry {
  key: string;
  parent?: string;
  file: string;
  order: BookCrossrefOrder;
  caption?: string;
}

interface BookCrossrefHeading {
  id: string;
  files: string[];
}

interface BookCrossrefOrder {
  number: number;
  section?: number[];
}

function isChapterRef(entry: BookCrossrefEntry) {
  if (refType(entry.key) === "sec" && entry.order.section) {
    return !entry.order.section.slice(1).some((index) => index > 0);
  } else {
    return false;
  }
}

function bookCrossrefIndexForOutputFile(
  outputFile: string,
  indexes: BookCrossrefIndex[],
) {
  return indexes.find((index) =>
    Object.keys(index.files).find((file) => file === outputFile)
  );
}

async function bookCrossrefIndexes(
  context: ProjectContext,
): Promise<BookCrossrefIndex[]> {
  // create a separate index for each format we encounter
  const indexes = {} as Record<string, BookCrossrefIndex>;

  const renderFiles = bookConfigRenderItems(context.config).filter((item) =>
    !!item.file
  );
  for (const renderFile of renderFiles) {
    const file = renderFile.file!;
    const index = await inputTargetIndex(context, file);
    if (index) {
      for (const formatName of Object.keys(index.formats)) {
        if (isMultiFileBookFormat(defaultWriterFormat(formatName))) {
          const format = index.formats[formatName];
          if (format.pandoc[kOutputFile]) {
            const outputFile = join(dirname(file), format.pandoc[kOutputFile]!);
            const indexFile = crossrefIndexForOutputFile(
              context.dir,
              file,
              outputFile,
            );

            if (existsSync(indexFile)) {
              const indexJson = JSON.parse(Deno.readTextFileSync(indexFile));

              // ensure we have an index for this format
              indexes[formatName] = indexes[formatName] ||
                { files: {}, entries: {}, headings: {} };
              const index = indexes[formatName];

              // set file options
              index.files[outputFile] = indexJson.options || {};

              // grab entries
              indexJson.entries.forEach((entry: BookCrossrefEntry) => {
                index.entries[entry.key] = {
                  ...entry,
                  file: outputFile,
                };
              });

              // grab headings
              indexJson.headings.forEach((heading: string) => {
                if (!index.headings[heading]) {
                  index.headings[heading] = {
                    id: heading,
                    files: [],
                  };
                }
                index.headings[heading].files.push(outputFile);
              });
            }
          }
        }
      }
    }
  }

  return Object.values(indexes);
}

function formatCrossref(
  type: string,
  options: BookCrossrefOptions,
  entry: BookCrossrefEntry,
  noPrefix: boolean,
  format: Format,
  parent?: BookCrossrefEntry,
) {
  const { language } = format;
  if (parent) {
    const crossref: string[] = [];
    const parentType = refType(parent.key);
    crossref.push(numberOption(parent.order, options, parentType));
    crossref.push(" (");
    crossref.push(numberOption(entry.order, options, "subref", "alpha a"));
    crossref.push(")");
    return crossref.join("");
  }

  if (format.pandoc["number-sections"] === false) {
    return entry.caption || entry.key;
  }

  // if this is a section we need a prefix
  const refNumber = numberOption(entry.order, options, type);
  if (type === "sec" && !noPrefix) {
    const prefix = (options[kCrossrefChapters] && isChapterRef(entry))
      ? options[kCrossrefChaptersAppendix]
        ? language[kCrossrefApxPrefix]
        : language[kCrossrefChPrefix]
      : language[kCrossrefSecPrefix];
    const crossref = prefix + " " + refNumber;
    return crossref;
  } else {
    return refNumber;
  }
}

function refWithChapter(
  options: BookCrossrefOptions,
  ref: string,
  section?: number[],
) {
  if (options[kCrossrefChapters] !== false) {
    const chapter = section ? section[0] : undefined;
    const chapterPrefix = chapter
      ? formatChapterIndex(options, chapter) + "."
      : "";
    return chapterPrefix + ref;
  } else {
    return ref;
  }
}

function refType(id: string) {
  const match = id.match(/^(\w+)-/);
  return (match ? match[1] : "fig").toLowerCase();
}

function numberOption(
  order: BookCrossrefOrder,
  options: BookCrossrefOptions,
  type: string,
  defaultFormat?: string,
) {
  if (type === "sec" && order.section) {
    return sectionNumber(options, order.section);
  }

  const style = numberStyle(options, type, defaultFormat);

  if (Array.isArray(style)) {
    const entryCount = style.length;
    const entryIndex = (order.number - 1) % entryCount;
    const option = style[entryIndex];
    return refWithChapter(options, option, order.section);
  } else if (style.match(/^alpha /)) {
    let startIndexChar = style[style.length - 1];
    if (startIndexChar === " ") {
      startIndexChar = "a";
    }
    const startIndex = startIndexChar.charCodeAt(0);
    return refWithChapter(
      options,
      String.fromCharCode(startIndex + order.number - 1),
      order.section,
    );
  } else if (style.match(/^roman/)) {
    const lower = style.endsWith("i");
    return refWithChapter(
      options,
      convertToRoman(order.number, lower),
      order.section,
    );
  } else { // arabic
    return refWithChapter(options, order.number.toString(), order.section);
  }
}

function numberStyle(
  options: BookCrossrefOptions,
  type: string,
  defaultFormat?: string,
) {
  // compute option name and default value
  const opt = `${type}-labels`;
  if (defaultFormat === undefined) {
    defaultFormat = "arabic";
  }

  // see if there a global label option, if so, use that
  // if the type specific label isn't specified
  const labelOpt = options[kCrossrefLabels] || defaultFormat;

  // detemrine the style
  return options[opt] as string | string[] || labelOpt;
}

function sectionNumber(options: BookCrossrefOptions, section: number[]) {
  let lastIndex = 0;
  for (let i = section.length - 1; i >= 0; i--) {
    if (section[i] > 0) {
      lastIndex = i;
      break;
    }
  }
  const num: string[] = [];
  for (let i = 0; i <= lastIndex; i++) {
    if (i === 0) {
      const chapIndex = formatChapterIndex(options, section[i]);
      if (chapIndex) {
        num.push(chapIndex);
      }
    } else {
      num.push(section[i].toString());
    }
  }
  return num.join(".");
}

function formatChapterIndex(options: BookCrossrefOptions, index: number) {
  return index
    ? options[kCrossrefChaptersAlpha]
      ? String.fromCharCode(64 + index)
      : index.toString()
    : "";
}

function convertToRoman(num: number, lower: boolean) {
  const roman = {
    M: 1000,
    CM: 900,
    D: 500,
    CD: 400,
    C: 100,
    XC: 90,
    L: 50,
    XL: 40,
    X: 10,
    IX: 9,
    V: 5,
    IV: 4,
    I: 1,
  } as Record<string, number>;
  let str = "";
  for (const i of Object.keys(roman)) {
    const q = Math.floor(num / roman[i]);
    num -= q * roman[i];
    str += lower ? i.toLowerCase().repeat(q) : i.repeat(q);
  }
  return str;
}
