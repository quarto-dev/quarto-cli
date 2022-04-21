/*
* break-quarto-md.ts
*
* Breaks up a qmd file into a list of chunks of related text: YAML
* front matter, "pure" markdown, triple-backtick sections, and so on.
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { lineOffsets, lines } from "./text.ts";
import { Range, rangedLines, RangedSubstring } from "./ranged-text.ts";
import { asMappedString, EitherString, mappedString } from "./mapped-text.ts";

import { partitionCellOptionsMapped } from "./partition-cell-options.ts";

import { QuartoMdCell, QuartoMdChunks } from "./break-quarto-md-types.ts";

export type { QuartoMdCell, QuartoMdChunks } from "./break-quarto-md-types.ts";

// xml regex fragments
//
// this requires /u in the regex specifier !
// https://www.w3.org/TR/2006/REC-xml11-20060816/#NT-NameStartChar
const nameStartChar =
  `[:A-Z_a-z\u{C0}-\u{D6}\u{D8}-\u{F6}\u{F8}-\u{2FF}\u{370}-\u{37D}\u{37F}-\u{1FFF}\u{200C}-\u{200D}\u{2070}-\u{218F}\u{2C00}-\u{2FEF}\u{3001}-\u{D7FF}\u{F900}-\u{FDCF}\u{FDF0}-\u{FFFD}\u{10000}-\u{EFFFF}]`;
const nameChar =
  `(?:${nameStartChar}|[-.0-9\u{B7}\u{0300}-\u{036F}\u{203F}-\u{2040}])`;
const name = `(?:${nameStartChar}${nameChar}*)`;

// https://www.w3.org/TR/xml/#NT-CharRef
const entityRef = `[&]${name}[;]`;
const charRef = `(?:[&][#][0-9]+[;]|[&][#]x[0-9a-fA-F]+[;])`;
const reference = `(?:${entityRef}|${charRef})`;
const attrValue =
  `(?:["](?:[^<&"]|${reference})*["]|['](?:[^<&']|${reference})*['])`;

const attribute = `(?:${name}\\s*=\\s*${attrValue})`;

const htmlTagNames = new Set([
  "a",
  "abbr",
  "acronym",
  "address",
  "applet",
  "area",
  "article",
  "aside",
  "audio",
  "b",
  "base",
  "basefont",
  "bdi",
  "bdo",
  "bgsound",
  "big",
  "blink",
  "blockquote",
  "body",
  "br",
  "button",
  "canvas",
  "caption",
  "center",
  "cite",
  "code",
  "col",
  "colgroup",
  "content",
  "data",
  "datalist",
  "dd",
  "del",
  "details",
  "dfn",
  "dialog",
  "dir",
  "div",
  "dl",
  "dt",
  "em",
  "embed",
  "fieldset",
  "figcaption",
  "figure",
  "font",
  "footer",
  "form",
  "frame",
  "frameset",
  "head",
  "header",
  "h1",
  "hgroup",
  "hr",
  "html",
  "i",
  "iframe",
  "image",
  "img",
  "input",
  "ins",
  "kbd",
  "keygen",
  "label",
  "legend",
  "li",
  "link",
  "main",
  "map",
  "mark",
  "marquee",
  "menu",
  "menuitem",
  "meta",
  "meter",
  "nav",
  "nobr",
  "noembed",
  "noframes",
  "noscript",
  "object",
  "ol",
  "optgroup",
  "option",
  "output",
  "p",
  "param",
  "picture",
  "plaintext",
  "portal",
  "pre",
  "progress",
  "q",
  "rb",
  "rp",
  "rt",
  "rtc",
  "ruby",
  "s",
  "samp",
  "script",
  "section",
  "select",
  "shadow",
  "slot",
  "small",
  "source",
  "spacer",
  "span",
  "strike",
  "strong",
  "style",
  "sub",
  "summary",
  "sup",
  "table",
  "tbody",
  "td",
  "template",
  "textarea",
  "tfoot",
  "th",
  "thead",
  "time",
  "title",
  "tr",
  "track",
  "tt",
  "u",
  "ul",
  "var",
  "video",
  "wbr",
  "xmp",
]);

export async function breakQuartoMd(
  src: EitherString,
  validate = false,
) {
  if (typeof src === "string") {
    src = asMappedString(src);
  }

  // notebook to return
  const nb: QuartoMdChunks = {
    cells: [],
  };

  const startComponent = new RegExp(
    `^\\s*<(${name})(\\s+${attribute})*\\s*>\\s*$`,
    "u",
  );
  const emptyComponent = new RegExp(
    `^\\s*<(${name})(\\s+${attribute})*\\s*/>\\s*$`,
    "u",
  );
  const endComponent = new RegExp(`^\\s*</(${name})\\s*>\\s*$`, "u");

  const isHtmlTag = (str: string) => {
    const someMatch = str.match(startComponent) || str.match(emptyComponent) ||
      str.match(endComponent);
    return htmlTagNames.has((someMatch as string[])[1]);
  };

  // regexes
  const yamlRegEx = /^---\s*$/;
  const startCodeCellRegEx = new RegExp(
    "^\\s*```+\\s*\\{([=A-Za-z]+)( *[ ,].*)?\\}\\s*$",
  );
  const startCodeRegEx = /^```/;
  const endCodeRegEx = /^```+\s*$/;
  const delimitMathBlockRegEx = /^\$\$/;

  let language = ""; // current language block
  const tagName: string[] = [];
  const tagOptions: Record<string, string>[] = []; // tag options needs to be a stack to remember the options as we close the tag
  let cellStartLine = 0;

  // line buffer
  let codeStartRange: RangedSubstring;
  let codeEndRange: RangedSubstring;

  const lineBuffer: RangedSubstring[] = [];
  const flushLineBuffer = async (
    cell_type:
      | "markdown"
      | "code"
      | "raw"
      | "math"
      | "empty_component"
      | "component",
    index: number,
  ) => {
    if (lineBuffer.length) {
      // TODO understand why was this here. This makes our line
      // count computations wrong
      //
      // if (lineBuffer[lineBuffer.length - 1].substring === "") {
      //   lineBuffer.splice(lineBuffer.length - 1, 1);
      // }

      const mappedChunks: Range[] = [];
      for (const line of lineBuffer) {
        mappedChunks.push(line.range);
      }

      const source = mappedString(src, mappedChunks);

      const makeCellType = () => {
        if (cell_type === "code") {
          return { language };
        } else if (
          cell_type === "component" || cell_type === "empty_component"
        ) {
          return {
            language: "_component",
            tag: tagName[tagName.length - 1],
            options: tagOptions[tagOptions.length - 1]!,
          };
        } else {
          return cell_type;
        }
      };

      const cell: QuartoMdCell = {
        // deno-lint-ignore camelcase
        cell_type: makeCellType(),
        source,
        sourceOffset: 0,
        sourceStartLine: 0,
        sourceVerbatim: source,
        cellStartLine,
      };

      // the next cell will start on the next index.
      cellStartLine = index + 1;

      if (cell_type === "code") {
        // see if there is embedded metadata we should forward into the cell metadata
        const { yaml, sourceStartLine } = await partitionCellOptionsMapped(
          language,
          cell.source,
          validate,
        );
        // TODO I'd prefer for this not to depend on sourceStartLine now
        // that we have mapped strings infrastructure
        const breaks = Array.from(lineOffsets(cell.source.value)).slice(1);
        let strUpToLastBreak = "";
        if (sourceStartLine > 0) {
          if (breaks.length) {
            const lastBreak =
              breaks[Math.min(sourceStartLine - 1, breaks.length - 1)];
            strUpToLastBreak = cell.source.value.substring(0, lastBreak);
          } else {
            strUpToLastBreak = cell.source.value;
          }
        }
        // TODO Fix ugly way to compute sourceOffset..
        const prefix = "```{" + language + "}\n";
        cell.sourceOffset = strUpToLastBreak.length + prefix.length;

        cell.sourceVerbatim = mappedString(src, [
          codeStartRange!.range,
          ...mappedChunks,
          codeEndRange!.range,
        ]);
        cell.options = yaml;
        cell.sourceStartLine = sourceStartLine;
      } else if (cell_type === "empty_component" || cell_type === "component") {
        // components only carry tag source in sourceVerbatim, analogously to code
        cell.source = mappedString(src, mappedChunks.slice(1, -1));
      }
      // if the source is empty then don't add it
      if (
        mdTrimEmptyLines(lines(cell.sourceVerbatim.value)).length > 0 ||
        cell.options !== undefined
      ) {
        nb.cells.push(cell);
      }

      lineBuffer.splice(0, lineBuffer.length);
    }
  };

  const tickCount = (s: string): number =>
    Array.from(s.split(" ")[0] || "").filter((c) => c === "`").length;

  // loop through lines and create cells based on state transitions
  let inYaml = false,
    inMathBlock = false,
    inCodeCell = false,
    inCode = 0; // inCode stores the tick count of the code block

  const inPlainText = () =>
    !inCodeCell && !inCode && !inMathBlock && !inYaml &&
    tagName.length === 0;

  const srcLines = rangedLines(src.value, true);

  for (let i = 0; i < srcLines.length; ++i) {
    const line = srcLines[i];
    console.log({ line, inPlainText: inPlainText() });
    // yaml front matter
    if (
      yamlRegEx.test(line.substring) && !inCodeCell && !inCode &&
      !inMathBlock && tagName.length === 0
    ) {
      if (inYaml) {
        lineBuffer.push(line);
        await flushLineBuffer("raw", i);
        inYaml = false;
      } else {
        await flushLineBuffer("markdown", i);
        lineBuffer.push(line);
        inYaml = true;
      }
    } // found empty component
    else if (
      inPlainText() && emptyComponent.test(line.substring) &&
      !isHtmlTag(line.substring)
    ) {
      await flushLineBuffer("markdown", i);
      const m = line.substring.match(emptyComponent);
      tagName.push(m![1] as string);
      if (m![2] !== undefined) {
        tagOptions.push(parseAttributes(m![2]));
      } else {
        tagOptions.push({});
      }
      lineBuffer.push(line);
      await flushLineBuffer("empty_component", i);
      tagOptions.pop();
      tagName.pop();
    } // found component start
    else if (
      inPlainText() && startComponent.test(line.substring) &&
      !isHtmlTag(line.substring)
    ) {
      await flushLineBuffer("markdown", i);
      const m = line.substring.match(startComponent);
      tagName.push(m![1] as string);
      if (m![2] !== undefined) {
        tagOptions.push(parseAttributes(m![2]));
      } else {
        tagOptions.push({});
      }
      lineBuffer.push(line);
    } // found inner component start
    else if (
      tagName.length > 0 && startComponent.test(line.substring) &&
      !isHtmlTag(line.substring)
    ) {
      const m = line.substring.match(startComponent);
      tagName.push(m![1] as string);
      if (m![2] !== undefined) {
        tagOptions.push(parseAttributes(m![2]));
      } else {
        tagOptions.push({});
      }
      lineBuffer.push(line);
    } // found inner component end
    else if (
      tagName.length > 0 && endComponent.test(line.substring) &&
      !isHtmlTag(line.substring)
    ) {
      const m = line.substring.match(endComponent);
      const closeTagName = m![1] as string;
      if (
        tagName[tagName.length - 1].toLocaleLowerCase() !==
          closeTagName.toLocaleLowerCase()
      ) {
        console.log("mismatched tags!!!");
      }
      lineBuffer.push(line);
      if (tagName.length === 1) {
        await flushLineBuffer("component", i);
      }
      tagName.pop();
      tagOptions.pop();
    } // begin code cell: ^```python
    else if (startCodeCellRegEx.test(line.substring) && inPlainText()) {
      const m = line.substring.match(startCodeCellRegEx);
      language = (m as string[])[1];
      await flushLineBuffer("markdown", i);
      inCodeCell = true;
      codeStartRange = line;

      // end code block: ^``` (tolerate trailing ws)
    } else if (
      endCodeRegEx.test(line.substring) &&
      (inCodeCell || (inCode && tickCount(line.substring) === inCode))
    ) {
      // in a code cell, flush it
      if (inCodeCell) {
        codeEndRange = line;
        inCodeCell = false;
        await flushLineBuffer("code", i);
      } else {
        // otherwise, sets inCode to 0 and continue
        inCode = 0;
        lineBuffer.push(line);
      }

      // begin code block: ^```
    } else if (startCodeRegEx.test(line.substring)) {
      inCode = tickCount(line.substring);
      lineBuffer.push(line);
    } else if (delimitMathBlockRegEx.test(line.substring)) {
      if (inMathBlock) {
        lineBuffer.push(line);
        await flushLineBuffer("math", i);
      } else {
        if (inYaml || inCode || inCodeCell || tagName.length > 0) {
          // TODO signal a parse error?
          // for now, we just skip.
        } else {
          await flushLineBuffer("markdown", i);
        }
        lineBuffer.push(line);
      }
      inMathBlock = !inMathBlock;
    } else {
      lineBuffer.push(line);
    }
  }

  // if there is still a line buffer then make it a markdown cell
  await flushLineBuffer("markdown", srcLines.length);

  return nb;
}

function mdTrimEmptyLines(lines: string[]) {
  // trim leading lines
  const firstNonEmpty = lines.findIndex((line) => line.trim().length > 0);
  if (firstNonEmpty === -1) {
    return [];
  }
  lines = lines.slice(firstNonEmpty);

  // trim trailing lines
  let lastNonEmpty = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim().length > 0) {
      lastNonEmpty = i;
      break;
    }
  }

  if (lastNonEmpty > -1) {
    lines = lines.slice(0, lastNonEmpty + 1);
  }

  return lines;
}

const htmlUnescapes: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
};

function unescapeEntities(str: string) {
  return str.replace(new RegExp(reference, "u"), function (match: string) {
    if (match.startsWith("&#x")) {
      return String.fromCharCode(Number(match.slice(3, -1)));
    } else if (match.startsWith("&#")) {
      return String.fromCharCode(parseInt(match.slice(2, -1), 16));
    } else {
      if (htmlUnescapes[match] !== undefined) {
        return htmlUnescapes[match];
      } else {
        return match;
      }
    }
  });
}

function parseAttributes(attrString: string): Record<string, string> {
  const result: Record<string, string> = {};
  attrString = attrString.trim();

  // assumes XML for now, so every attribute is a foo=bar thing instead of allowing boolean attributes

  while (attrString.indexOf("=") !== -1) {
    const l = attrString.split("=")[0];
    const attrName = l.trim();
    const rest = attrString.slice(l.length + 1);
    let attrValue: string;
    if (rest.startsWith('"')) {
      const end = rest.slice(1).indexOf('"') + 1;
      attrValue = rest.slice(1, end);
      attrString = rest.slice(end + 1);
    } else if (rest.startsWith("'")) {
      const end = rest.slice(1).indexOf("'") + 1;
      attrValue = rest.slice(1, end);
      attrString = rest.slice(end + 1);
    } else {
      const end = rest.indexOf(" ");
      if (end === -1) {
        attrValue = rest;
        attrString = "";
      } else {
        attrValue = rest.slice(0, end);
        attrString = rest.slice(end + 1);
      }
    }

    result[attrName] = unescapeEntities(attrValue);
  }
  return result;
}
