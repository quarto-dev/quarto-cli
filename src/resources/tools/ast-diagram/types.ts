// TypeScript definitions for Pandoc AST

export interface PandocAST {
  "pandoc-api-version": number[];
  meta: Record<string, MetaValue>;
  blocks: Block[];
}

// Meta value types
export type MetaValue = 
  | MetaMap
  | MetaList
  | MetaBlocks
  | MetaInlines
  | MetaBool
  | MetaString;

export interface MetaMap {
  t: "MetaMap";
  c: Record<string, MetaValue>;
}

export interface MetaList {
  t: "MetaList";
  c: MetaValue[];
}

export interface MetaBlocks {
  t: "MetaBlocks";
  c: Block[];
}

export interface MetaInlines {
  t: "MetaInlines";
  c: Inline[];
}

export interface MetaBool {
  t: "MetaBool";
  c: boolean;
}

export interface MetaString {
  t: "MetaString";
  c: string;
}

// Block element types
export type Block = 
  | HeaderBlock
  | ParaBlock
  | BulletListBlock
  | DivBlock
  | CodeBlockBlock
  | PlainBlock
  | OrderedListBlock
  | BlockQuoteBlock
  | RawBlockBlock
  | HorizontalRuleBlock
  | TableBlock
  | DefinitionListBlock
  | FigureBlock
  | LineBlockBlock;

// Inline element types
export type Inline = 
  | StrInline
  | SpaceInline
  | CodeInline
  | LinkInline
  | SpanInline
  | EmphInline
  | StrongInline
  | StrikeoutInline
  | SubscriptInline
  | SuperscriptInline
  | SmallCapsInline
  | UnderlineInline
  | QuotedInline
  | RawInlineInline
  | MathInline
  | ImageInline
  | SoftBreakInline
  | LineBreakInline
  | NoteInline
  | CiteInline;

// Attributes type
export type Attr = [string, string[], [string, string][]];

// Block type definitions
export interface HeaderBlock {
  t: "Header";
  c: [number, Attr, Inline[]];
}

export interface ParaBlock {
  t: "Para";
  c: Inline[];
}

export interface BulletListBlock {
  t: "BulletList";
  c: Block[][];
}

export interface DivBlock {
  t: "Div";
  c: [Attr, Block[]];
}

export interface CodeBlockBlock {
  t: "CodeBlock";
  c: [Attr, string];
}

export interface PlainBlock {
  t: "Plain";
  c: Inline[];
}

export interface OrderedListBlock {
  t: "OrderedList";
  c: [[number, { t: string }, { t: string }], Block[][]];
}

export interface BlockQuoteBlock {
  t: "BlockQuote";
  c: Block[];
}

export interface RawBlockBlock {
  t: "RawBlock";
  c: [string, string];
}

export interface HorizontalRuleBlock {
  t: "HorizontalRule";
  c?: [];
}

export interface TableBlock {
  t: "Table";
  c: any[]; // Complex structure simplified
}

export interface DefinitionListBlock {
  t: "DefinitionList";
  c: [Inline[], Block[][]][];
}

export interface FigureBlock {
  t: "Figure";
  c: [Attr, [null, Block[]], Block[]];
}

export interface LineBlockBlock {
  t: "LineBlock";
  c: Inline[][];
}

// Inline type definitions
export interface StrInline {
  t: "Str";
  c: string;
}

export interface SpaceInline {
  t: "Space";
  c?: [];
}

export interface CodeInline {
  t: "Code";
  c: [Attr, string];
}

export interface LinkInline {
  t: "Link";
  c: [Attr, Inline[], [string, string]];
}

export interface SpanInline {
  t: "Span";
  c: [Attr, Inline[]];
}

export interface EmphInline {
  t: "Emph";
  c: Inline[];
}

export interface StrongInline {
  t: "Strong";
  c: Inline[];
}

export interface StrikeoutInline {
  t: "Strikeout";
  c: Inline[];
}

export interface SubscriptInline {
  t: "Subscript";
  c: Inline[];
}

export interface SuperscriptInline {
  t: "Superscript";
  c: Inline[];
}

export interface UnderlineInline {
  t: "Underline";
  c: Inline[];
}

export interface QuotedInline {
  t: "Quoted";
  c: [{ t: "SingleQuote" | "DoubleQuote" }, Inline[]];
}

export interface SmallCapsInline {
  t: "SmallCaps";
  c: Inline[];
}

export interface RawInlineInline {
  t: "RawInline";
  c: [string, string];
}

export interface MathInline {
  t: "Math";
  c: [{ t: "InlineMath" | "DisplayMath" }, string]; // [MathType, Content]
}

export interface ImageInline {
  t: "Image";
  c: [Attr, Inline[], [string, string]]; // [Attr, Alt, [URL, Title]]
}

export interface SoftBreakInline {
  t: "SoftBreak";
  c?: [];
}

export interface LineBreakInline {
  t: "LineBreak";
  c?: [];
}

export interface NoteInline {
  t: "Note";
  c: Block[]; // Content of the footnote as block elements
}

// Citation mode type
export interface CitationMode {
  t: "AuthorInText" | "SuppressAuthor" | "NormalCitation";
}

// Citation type
export interface Citation {
  citationId: string;
  citationPrefix: Inline[];
  citationSuffix: Inline[];
  citationMode: CitationMode;
  citationNoteNum: number;
  citationHash: number;
}

export interface CiteInline {
  t: "Cite";
  c: [Citation[], Inline[]]; // [Citations array, Text representation]
}