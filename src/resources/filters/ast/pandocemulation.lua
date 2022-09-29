-- pandocemulation.lua
-- sets up pandoc overrides to emulate its behavior in Lua
--
-- Copyright (C) 2022 by RStudio, PBC

function emulated_node_concat(a, b)
  if a.is_emulated or a.t == "Inlines" or a.t == "Blocks" or a.t == "List" then -- these are the emulated arrays
    a = from_emulated(a)
  end
  if b.is_emulated or b.t == "Inlines" or b.t == "Blocks" or b.t == "List" then -- these are the emulated arrays
    b = from_emulated(b)
  end
  return a .. b
end

pandoc_is_block = {
  BlockQuote = true,
  BulletList = true,
  CodeBlock = true,
  DefinitionList = true,
  Div = true,
  Header = true,
  HorizontalRule = true,
  LineBlock = true,
  OrderedList = true,
  Para = true,
  Plain = true,
  RawBlock = true,
  Table = true
}

pandoc_is_inline = {
  Cite = true,
  Code = true,
  Emph = true,
  Image = true,
  LineBreak = true,
  Link = true,
  Math = true,
  Note = true,
  Quoted = true,
  RawInline = true,
  SmallCaps = true,
  SoftBreak = true,
  Space = true,
  Span = true,
  Str = true,
  Strikeout = true,
  Strong = true,
  Subscript = true,
  Superscript = true,
  Underline = true
}

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

pandoc_fixed_field_types = {
  BlockQuote = { content = "Blocks" },
  BulletList = { content = "List" }, -- BlocksList, but we can't represent that
  Cell = { attr = "Attr" },
  Cite = { content = "Inlines" },
  Code = { attr = "Attr" },
  CodeBlock = { attr = "Attr" },
  DefinitionList = { content = "List" }, -- list of (Inlines, BlocksList), but we can't represent that
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
  TableFoot = { attr = "Attr", rows = "List" },
  TableHead = { attr = "Attr", rows = "List" },
  Underline = { content = "Inlines" },
}

local function is_unemulated_pandoc_obj(a)
  return type(a) == "userdata" and not a.is_emulated
end

function emulated_node_eq(a, b)
  local a_is_unemulated_pandoc_obj = is_unemulated_pandoc_obj(a)
  local b_is_unemulated_pandoc_obj = is_unemulated_pandoc_obj(b)
  
  if a_is_unemulated_pandoc_obj or b_is_unemulated_pandoc_obj then
    if a_is_unemulated_pandoc_obj then
      a = to_emulated(a)
    end
    if b_is_unemulated_pandoc_obj then
      b = to_emulated(b)
    end
    return a == b
  end

  if type(a) ~= type(b) then
    return false
  end

  -- now they have the same types, and one of them has to be an
  -- emualted node because otherwise this function wouldn't be
  -- called, so both have type == "userdata". but then,
  -- if either was not emulated, we would have picked it up above.
  -- so we know that both nodes here are emulated.

  if a.t ~= b.t then
    return false
  end

  for k, v in pairs(a) do
    if v ~= b[k] then return false end
  end
  return true
end

local pandoc_ast_methods = {
  clone = function(self)
    -- TODO deep copy?
    return quarto.ast.copy_as_emulated_node(self)
  end,
  walk = function(node, filter)
    return emulate_pandoc_walk(node, filter)
  end,

  -- custom nodes override this in their metatable
  is_custom = false
}

function create_emulated_node(t, is_custom)
  if t == "Inlines" or t == "Blocks" or t == "List" then
    return pandoc[t]({})
  end
  local emulatedNode = {}
  is_custom = is_custom or false

  local metaFields = {
    t = t,
    is_emulated = true,
    is_custom = is_custom
  }

  for k, v in pairs(pandoc_fixed_field_types[t] or {}) do
    metaFields[k] = create_emulated_node(v)
  end

  local special_resolution = function(tbl, key)
    if metaFields[key] then return true, metaFields[key] end
    if key == "identifier" and tbl.attr then return true, tbl.attr.identifier end
    if key == "attributes" and tbl.attr then return true, tbl.attr.attributes end
    if key == "classes" and tbl.attr then return true, tbl.attr.classes end
    if key == "c" then
      if tbl.content then return true, tbl.content end
    end
    return false
  end

  setmetatable(emulatedNode, {
    __index = function(tbl, key)
      local resolved, value = special_resolution(tbl, key)
      if resolved then return value end
      local method = pandoc_ast_methods[key]
      if method then return method end
    end,
    __eq = emulated_node_eq,
    __pairs = function(tbl)
      local inMeta = pandoc_fixed_field_types[t] ~= nil
      local index

      return function()
        local k, v
        if inMeta then
          k, v = next(pandoc_fixed_field_types[t], index)
          if k == nil then
            inMeta = false
            index = nil
          else
            index = k
            return k, metaFields[k]
          end
        end

        -- two if statements because we want to fall
        -- through the end of the first into the second
        if not inMeta then
          repeat
            k, v = next(emulatedNode, index)
            if k == nil then
              return nil
            end
            index = k
          until k ~= "attr" and type(v) ~= "function"
          return k, v
        end
      end      
    end,
    __concat = emulated_node_concat,
    __newindex = function(tbl, key, value)
      local fixedFieldType = (pandoc_fixed_field_types[t] or {})[key]
      if fixedFieldType then
        metaFields[key] = pandoc[fixedFieldType](value)
      else
        rawset(tbl, key, value)
      end
    end
  })

  return emulatedNode
end
