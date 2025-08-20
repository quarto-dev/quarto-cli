/*
 * json.ts
 *
 * Copyright (C) 2025 Posit Software, PBC
 */

// An EDSL for building Pandoc AST JSON

// utilities
export type Attr = [string, string[], string[][]];
export type Caption = [null, Block[]];
export type Alignment = { "t": "AlignLeft" } | { "t": "AlignCenter" } | {
  "t": "AlignRight";
};
export type ColWidth = { "t": "ColWidthDefault" } | {
  "t": "ColWidth";
  c: number;
};
export type ColSpec = [Alignment, ColWidth];

export type TableHead = [Attr, TableRow[]];
export type TableRow = [Attr, TableCell[]];
export type TableCell = [Attr, Alignment, number, number, Block[]];

export type TableBody = [Attr, number, TableRow[], TableRow[]];
export type TableFoot = [Attr, TableRow[]];
export type Citation = {
  citationId: string;
  citationPrefix: Inline[];
  citationSuffix: Inline[];
  citationMode: { "t": "AuthorInText" | "SuppressAuthor" | "NormalCitation" };
  citationNoteNum: number;
  citationHash: number;
};

// Inlines
export type Cite = {
  "t": "Cite";
  "c": [Citation[], Inline[]];
};

export type Code = {
  "t": "Code";
  "c": [Attr, string];
};

export type Emph = {
  "t": "Emph";
  "c": Inline[];
};

export type Image = {
  "t": "Image";
  "c": [Attr, Inline[], [string, string]];
};

export type LineBreak = { "t": "LineBreak" };

export type Link = {
  "t": "Link";
  "c": [Attr, Inline[], [string, string]];
};

export type Math = {
  "t": "Math";
  "c": [{ "t": "DisplayMath" | "InlineMath" }, string];
};

export type Note = {
  "t": "Note";
  "c": Block[];
};

export type Quoted = {
  "t": "Quoted";
  "c": [{ "t": "DoubleQuote" | "SingleQuote" }, Inline[]];
};

export type RawInline = {
  "t": "RawInline";
  "c": [string, string];
};

export type SmallCaps = {
  "t": "SmallCaps";
  "c": Inline[];
};

export type SoftBreak = { "t": "SoftBreak" };

export type Space = { "t": "Space" };

export type Span = {
  "t": "Span";
  "c": [Attr, ...Span[]];
};

export type Str = {
  "t": "Str";
  "c": string;
};

export type Strikeout = {
  "t": "Strikeout";
  "c": Inline[];
};

export type Strong = {
  "t": "Strong";
  "c": Inline[];
};

export type Subscript = {
  "t": "Subscript";
  "c": Inline[];
};

export type Superscript = {
  "t": "Superscript";
  "c": Inline[];
};

export type Underline = {
  "t": "Underline";
  "c": Inline[];
};

export type Inline =
  | Cite
  | Code
  | Emph
  | Image
  | LineBreak
  | Link
  | Math
  | Note
  | Quoted
  | RawInline
  | SmallCaps
  | SoftBreak
  | Space
  | Span
  | Str
  | Strikeout
  | Strong
  | Subscript
  | Superscript
  | Underline;

// Define a type for inline elements that have c: Inline[] structure
type SimpleInlineType =
  | "Emph"
  | "SmallCaps"
  | "Strikeout"
  | "Strong"
  | "Subscript"
  | "Superscript"
  | "Underline";

// Type guard to check if an inline type is a SimpleInlineType
type SimpleInline = Extract<Inline, { t: SimpleInlineType; c: Inline[] }>;

// Blocks
export type BlockQuote = {
  "t": "BlockQuote";
  "c": Block[];
};

export type BulletList = {
  "t": "BulletList";
  "c": Block[][];
};

export type CodeBlock = {
  "t": "CodeBlock";
  "c": [Attr, string];
};

export type DefinitionList = {
  "t": "DefinitionList";
  "c": [Inline[], Block[]][];
};

export type Div = {
  "t": "Div";
  "c": [Attr, ...Block[]];
};

export type Figure = {
  "t": "Figure";
  "c": [Attr, [null, Block[]], Block[]];
};

export type Header = {
  "t": "Header";
  "c": [number, Attr, Inline[]];
};

export type HorizontalRule = {
  "t": "HorizontalRule";
};

export type LineBlock = {
  t: "LineBlock";
  c: Inline[][];
};

export type OrderedList = {
  "t": "OrderedList";
  "c": [[number, {
    "t":
      | "DefaultStyle"
      | "Example"
      | "Decimal"
      | "LowerRoman"
      | "UpperRoman"
      | "LowerAlpha"
      | "UpperAlpha";
  }, { "t": "DefaultDelim" | "Period" | "Paren" }], Block[][]];
};

export type Para = {
  "t": "Para";
  "c": Inline[];
};

export type Plain = {
  "t": "Plain";
  "c": Inline[];
};

export type RawBlock = {
  "t": "RawBlock";
  "c": [string, string];
};

export type Table = {
  "t": "Table";
  "c": [
    Attr,
    Caption,
    ColSpec[],
    TableHead,
    TableBody[],
    TableFoot,
  ];
};

export type Block =
  | BlockQuote
  | BulletList
  | CodeBlock
  | DefinitionList
  | Div
  | Figure
  | Header
  | HorizontalRule
  | LineBlock
  | OrderedList
  | Para
  | Plain
  | RawBlock
  | Table;

export type Pandoc = {
  "pandoc-api-version": [number, number, number];
  meta: Record<string, string>;
  blocks: Block[];
};

// inline constructors

export function attr(
  id?: string,
  classes?: string[],
  keyvals?: Record<string, string>,
): Attr {
  const keyvalsArray: string[][] = [];
  if (keyvals) {
    for (const [key, value] of Object.entries(keyvals)) {
      keyvalsArray.push([key, value]);
    }
  }
  return [id || "", classes || [], keyvalsArray];
}

const makeInlinesNode = <T extends SimpleInlineType>(name: T) =>
(
  content: Inline[],
): SimpleInline => {
  return {
    t: name,
    c: content,
  } as SimpleInline;
};
const ensureAttr = (attr?: Attr): Attr => {
  if (!attr) {
    return ["", [], []];
  }
  return attr;
};

export const cite = (citations: Citation[], content: Inline[]): Cite => ({
  t: "Cite",
  c: [citations, content],
});

export const code = (content: string, attr?: Attr): Code => ({
  t: "Code",
  c: [ensureAttr(attr), content],
});

export const emph = makeInlinesNode("Emph");

export const image = (
  content: Inline[],
  url: string,
  description = "",
  attr?: Attr,
): Image => ({
  t: "Image",
  c: [ensureAttr(attr), content, [url, description]],
});

export const lineBreak = (): LineBreak => ({
  t: "LineBreak",
});

export const link = (
  attr: Attr,
  content: Inline[],
  url: string,
  description = "",
): Link => ({
  t: "Link",
  c: [attr, content, [url, description]],
});

export const math = (
  type: "DisplayMath" | "InlineMath",
  content: string,
): Math => ({
  t: "Math",
  c: [{ t: type }, content],
});

export const note = (content: Block[]): Note => ({
  t: "Note",
  c: content,
});

export const quoted = (
  type: "DoubleQuote" | "SingleQuote",
  content: Inline[],
): Quoted => ({
  t: "Quoted",
  c: [{ t: type }, content],
});

export const rawInline = (format: string, content: string): RawInline => ({
  t: "RawInline",
  c: [format, content],
});

export const smallCaps = makeInlinesNode("SmallCaps");

export const softBreak = (): SoftBreak => ({
  t: "SoftBreak",
});

export const space = (): Space => ({
  t: "Space",
});

export const span = (attr: Attr, content: Span[]): Span => ({
  t: "Span",
  c: [attr, ...content],
});

export const str = (content: string): Str => ({
  t: "Str",
  c: content,
});

export const strikeout = makeInlinesNode("Strikeout");

export const strong = makeInlinesNode("Strong");

export const subscript = makeInlinesNode("Subscript");

export const superscript = makeInlinesNode("Superscript");

export const underline = makeInlinesNode("Underline");

// block constructors

export const blockQuote = (content: Block[]): BlockQuote => ({
  t: "BlockQuote",
  c: content,
});

export const bulletList = (content: Block[][]): BulletList => ({
  t: "BulletList",
  c: content,
});

export const codeBlock = (content: string, attr?: Attr): CodeBlock => ({
  t: "CodeBlock",
  c: [ensureAttr(attr), content],
});

export const definitionList = (
  content: [Inline[], Block[]][],
): DefinitionList => ({
  t: "DefinitionList",
  c: content,
});

export const div = (content: Block[], attr?: Attr): Div => ({
  t: "Div",
  c: [ensureAttr(attr), ...content],
});

export const figure = (
  caption: Caption,
  content: Block[],
  attr?: Attr,
): Figure => ({
  t: "Figure",
  c: [ensureAttr(attr), caption, content],
});

export const header = (
  level: number,
  content: Inline[],
  attr?: Attr,
): Header => ({
  t: "Header",
  c: [level, ensureAttr(attr), content],
});

export const horizontalRule = (): HorizontalRule => ({
  t: "HorizontalRule",
});

export const lineBlock = (content: Inline[][]): LineBlock => ({
  t: "LineBlock",
  c: content,
});

export const orderedList = (
  start: number,
  style:
    | "DefaultStyle"
    | "Example"
    | "Decimal"
    | "LowerRoman"
    | "UpperRoman"
    | "LowerAlpha"
    | "UpperAlpha",
  delimiter: "DefaultDelim" | "Period" | "Paren",
  content: Block[][],
): OrderedList => ({
  t: "OrderedList",
  c: [[start, { t: style }, { t: delimiter }], content],
});

export const para = (content: Inline[]): Para => ({
  t: "Para",
  c: content,
});

export const plain = (content: Inline[]): Plain => ({
  t: "Plain",
  c: content,
});

export const rawBlock = (format: string, content: string): RawBlock => ({
  t: "RawBlock",
  c: [format, content],
});

export const table = (
  caption: Caption,
  colSpec: ColSpec[],
  head: TableHead,
  body: TableBody[],
  foot?: TableFoot,
  attr?: Attr,
): Table => ({
  t: "Table",
  c: [
    ensureAttr(attr),
    caption,
    colSpec,
    head,
    body,
    foot || tableFoot([], ensureAttr()),
  ],
});

export const colspec = (
  alignment: "AlignLeft" | "AlignCenter" | "AlignRight",
  colWidth: "ColWidthDefault" | { t: "ColWidth"; c: number },
): ColSpec => {
  const alignmentObj: Alignment = { t: alignment };
  const colWidthObj: ColWidth = colWidth === "ColWidthDefault"
    ? { t: "ColWidthDefault" }
    : { t: "ColWidth", c: colWidth.c };
  return [
    alignmentObj,
    colWidthObj,
  ];
};

export const caption = (content: Block[]): Caption => [null, content];

export const tableHead = (rows: TableRow[], attr?: Attr): TableHead => [
  ensureAttr(attr),
  rows,
];

export const tableRow = (cells: TableCell[], attr?: Attr): TableRow => [
  ensureAttr(attr),
  cells,
];

export const tableCell = (
  content: Block[],
  alignment: "AlignLeft" | "AlignCenter" | "AlignRight" = "AlignLeft",
  colspan = 1,
  rowspan = 1,
  attr?: Attr,
): TableCell => [
  ensureAttr(attr),
  { t: alignment },
  colspan,
  rowspan,
  content,
];

export const tableBody = (
  body: TableRow[],
  head?: TableRow[],
  rowHeadColumns: number = 0,
  attr?: Attr,
): TableBody => [ensureAttr(attr), rowHeadColumns, body, head || []];

export const tableFoot = (rows: TableRow[], attr?: Attr): TableFoot => [
  ensureAttr(attr),
  rows,
];

export const citation = (
  citationId: string,
  citationPrefix: Inline[],
  citationSuffix: Inline[],
  citationMode:
    | "AuthorInText"
    | "SuppressAuthor"
    | "NormalCitation",
  citationNoteNum: number,
  citationHash: number,
): Citation => ({
  citationId,
  citationPrefix,
  citationSuffix,
  citationMode: { t: citationMode },
  citationNoteNum,
  citationHash,
});

export const pandoc = (
  meta: Record<string, string>,
  blocks: Block[],
): Pandoc => ({
  "pandoc-api-version": [1, 23, 1],
  meta,
  blocks,
});
