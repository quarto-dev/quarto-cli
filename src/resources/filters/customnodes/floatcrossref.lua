-- crossreffloat.lua
-- Copyright (C) 2023 Posit Software, PBC

_quarto.ast.add_handler({

  -- empty table so this handler is only called programmatically
  class_name = {},

  -- the name of the ast node, used as a key in extended ast filter tables
  ast_name = "FloatCrossref",

  -- generic names this custom AST node responds to
  -- this is still unimplemented
  generics = {"Crossref"},

  -- float crossrefs are always blocks
  kind = "Block",

  parse = function(div)
    fail("FloatCrossref nodes should not be parsed")
  end,

  slots = { "content", "caption_long", "caption_short" },

  constructor = function(tbl)
    return tbl
  end
})

local function get_table_from_float(float)
  -- this explicit check appears necessary for the case where
  -- float.content is directly a table, and not a container that
  -- contains a table.
  if float.content.t == "Table" then
    return float.content
  else
    local found_table = nil
    float.content:walk({
      Table = function(table)
        found_table = table
      end
    })
    return found_table
  end 
end

-- default renderer first
_quarto.ast.add_renderer("FloatCrossref", function(_)
  return true
end, function(float)
  quarto.utils.dump { float = float }
  return pandoc.Div({
    pandoc.Str("This is a placeholder FloatCrossref")
  })
end)

_quarto.ast.add_renderer("FloatCrossref", function(_)
  return _quarto.format.isHtmlOutput()
end, function(float)
  if float.parent_id then
    prependSubrefNumber(float.long_caption, float.order)
  else
    local title_prefix = tableTitlePrefix(float.order)
    if pandoc.utils.type(float.caption_long) == "Blocks" then
      tprepend(float.caption_long, title_prefix)
    else
      tprepend(float.caption_long.content, title_prefix)
    end
  end

  local found_table = get_table_from_float(float)
  if found_table then
    -- in HTML, we insert the float caption directly in the table
    -- and render that as the result
    local div = pandoc.Div({found_table})
    div.attr = pandoc.Attr(float.identifier, float.classes or {}, float.attributes or {})
    return div
  end

  -- quarto.utils.dump({ float = float })
  -- fail("STOP")
  return pandoc.Div({
    pandoc.Str("This is a placeholder FloatCrossref")
  })
end)