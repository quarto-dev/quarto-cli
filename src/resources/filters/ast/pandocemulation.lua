-- pandocemulation.lua
-- sets up pandoc overrides to emulate its behavior in Lua
-- Copyright (C) 2022 by RStudio, PBC

pandoc_emulated_node_factory = function(t)
  return function(...)
    local args = { ... }
    -- NB: we can't index into quarto.ast.pandoc in this function
    -- because it's used in the __index metatable of quarto.ast.pandoc
    -- which can cause infinite recursion

    local result = create_emulated_node(t)
    local argsTable = pandoc_constructors_args[t]
    if argsTable == nil then
      for i, v in pairs(args) do
        result[i] = v
      end
    else
      for i, _ in ipairs(argsTable) do
        result[argsTable[i]] = args[i]
      end
    end
    return result
  end
end

pandoc_constructors_args = {
  Pandoc = { "blocks", "meta" },
  
  -- blocks
  BlockQuote = { "content" },
  BulletList = { "content" },
  CodeBlock = { "text", "attr" },
  DefinitionList = { "content" },
  Div = { "content", "attr" },
  Header = { "level", "content", "attr" },
  HorizontalRule = {},
  LineBlock = { "content" },
  Null = {},
  OrderedList = { "content", "listAttributes" },
  Para = { "content" },
  Plain = { "content" },
  RawBlock = { "format", "text" },
  Table = { "caption", "colspecs", "head", "bodies", "foot", "attr" },
  SimpleTable = { "caption", "aligns", "widths", "headers", "rows" },

  -- inlines
  Cite = { "content", "citations" },
  Code = { "text", "attr" },
  Emph = { "content" },
  Image = { "caption", "src", "title", "attr" },
  LineBreak = {},
  Link = { "content", "target", "title", "attr" },
  Math = { "mathtype", "text" },

  -- FIXME add DisplayMath and InlineMath special cases
  Note = { "content" },
  Quoted = { "quotetype", "content" },
  
  -- FIXME add SingleQuoted and DoubleQuoted special cases
  RawInline = { "format", "text" },

  SmallCaps = { "content" },
  SoftBreak = {},
  Space = {},
  Span = { "content", "attr" },
  Str = { "text" },
  Strikeout = { "content" },
  Strong = { "content" },
  Subscript = { "content" },
  Superscript = { "content" },
  Underline = { "content" },

  -- others
  Citation = { "id", "mode", "prefix", "suffix", "note_num", "hash" },
  ListAttributes = { "start", "style", "delimiter" },
  Row = { "cells", "attr" },
  TableFoot = { "rows", "attr" },
  TableHead = { "rows", "attr" },
  TableBody = { "body", "head", "row_head_columns", "attr" },
  Cell = { "contents", "align", "row_span", "col_span", "attr" },
}


pandoc_has_attr = {
  Cell = true,
  Code = true,
  CodeBlock = true,
  Div = true,
  Header = true,
  Image = true,
  Link = true,
  Row = true,
  Span = true,
  Table = true,
  TableFoot = true,
  TableHead = true,
}

pandoc_fixed_field_types = {
  -- DefinitionList
  BlockQuote = { content = "Blocks" },
  BulletList = { content = "List" }, -- BlocksList, but we can't represent that
  Cell = { attr = "Attr" },
  Cite = { content = "Inlines" },
  Code = { attr = "Attr" },
  CodeBlock = { attr = "Attr" },
  Div = { content = "Blocks", attr = "Attr" },
  Emph = { content = "Inlines" },
  Header = { content = "Inlines", attr = "Attr" },
  Image = { caption = "Inlines", attr = "Attr" },
  LineBlock = { content = "List" }, -- InlinesList, but we can't represent that
  Link = { content = "Inlines", attr = "Attr" },
  Note = { content = "Blocks" },
  OrderedList = { content = "List" }, -- BlocksList, but we can't represent that
  Pandoc = { blocks = "Blocks", },
  Para = { content = "Inlines" },
  Plain = { content = "Inlines" },
  Quoted = { content = "Inlines" },
  Row = { attr = "Attr" },
  SmallCaps = { content = "Inlines" },
  Span = { content = "Inlines", attr = "Attr" },
  Strikeout = { content = "Inlines" },
  Strong = { content = "Inlines" },
  Subscript = { content = "Inlines" },
  Superscript = { content = "Inlines" },
  Table = { attr = "Attr" },
  TableFoot = { attr = "Attr" },
  TableHead = { attr = "Attr" },
  Underline = { content = "Inlines" },
}

function pandoc_emulate_eq(a, b)
  if type(a) == "userdata" or type(b) == "userdata" then
    if type(a) == "userdata" then
      a = denormalize(a)
    end
    if type(b) == "userdata" then
      b = denormalize(b)
    end
    return a == b
  end

  if not a.is_emulated or not b.is_emulated then
    return false
  end

  if a.t ~= b.t then
    return false
  end

  for k, v in pairs(a) do
    if v ~= b[k] then return false end
  end
  return true
end
