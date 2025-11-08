/*
 * types.ts
 *
 * Copyright (C) 2025 Posit Software, PBC
 */

export type Attr = {
  id?: string;
  classes: string[];
  data: Record<string, unknown>;
};

export type Text = Attr & {
  type: "Text";
  value: string;
};

type SimpleInline<T extends string> = Attr & {
  type: T;
  children: Inline[];
};

export type QuoteMark = "Single" | "Double"; // guillemets, etc etc
export type Strong = SimpleInline<"Strong">;
export type Emphasis = SimpleInline<"Emphasis">;
export type Strikeout = SimpleInline<"Strikeout">;
export type Superscript = SimpleInline<"Superscript">;
export type Subscript = SimpleInline<"Subscript">;
export type SmallCaps = SimpleInline<"SmallCaps">;
export type Underline = SimpleInline<"Underline">;
export type Span = SimpleInline<"Span">;

export type InlineQuote = Attr & {
  type: "InlineQuote";
  children: Inline[];
  mark: QuoteMark;
};

export type DisplayMath = Attr & {
  value: string;
  type: "DisplayMath";
};

export type InlineMath = Attr & {
  value: string;
  type: "InlineMath";
};

export type Image = Attr & {
  uri: string;
  title: string;
  type: "Image";
  children: Inline[];
};

export type Link = Attr & {
  uri: string;
  title: string;
  type: "Link";
  children: Inline[];
};

export type Citation = Attr & {
  mode: "AuthorInText" | "SupressAuthor" | "NormalCitation";
  prefix: Inline[];
  suffix: Inline[];
};

export type Cite = Attr & {
  type: "Cite";
  citations: Citation[];
  children: Inline[];
};

export type Inline =
  | Cite
  | DisplayMath
  | Emphasis
  | Image
  | InlineMath
  | Link
  | InlineQuote
  | SmallCaps
  | Span
  | Strikeout
  | Strong
  | Subscript
  | Superscript
  | Text
  | Underline;

type SimpleBlockBlock<T extends string> = Attr & {
  type: T;
  children: Block[];
};

type SimpleInlineBlock<T extends string> = Attr & {
  type: T;
  children: Inline[];
};

export type Paragraph = SimpleInlineBlock<"Paragraph">;
export type Plain = SimpleInlineBlock<"Plain">;
export type Div = SimpleBlockBlock<"Div">;
export type BlockQuote = SimpleBlockBlock<"BlockQuote">;

export type Heading = Attr & {
  type: "Heading";
  children: Inline[];
  level: number;
};

export type CodeBlock = Attr & {
  value: string;
  type: "CodeBlock";
};

export type Section = Attr & {
  type: "Section";
  children: Block[];
};

export type Block =
  | Section
  | BlockQuote
  | CodeBlock
  | Div
  | Heading
  | Paragraph
  | Plain;

export type Document = {
  metadata: Record<string, unknown>;
  title: Inline[];
  children: Block[];
};
