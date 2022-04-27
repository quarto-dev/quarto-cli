/*
* parse-directive-tag.ts
*
* Recognizes and parses directive opening, closing and self-closing tags.
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

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

export function isDirectiveTag(str: string) {
  const emptyDirective = new RegExp(
    `^\\s*<(${name})((?:\\s+${attribute})*)\\s*/>\\s*$`,
    "u",
  );

  const matches = str.match(emptyDirective);
  if (matches) {
    if (htmlTagNames.has(matches[1])) {
      return false;
    }
    const name = matches[1];
    const attributes = matches[2].length > 0 ? parseAttributes(matches[2]) : {};
    return {
      name,
      attributes,
    };
  }
  return false;
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
