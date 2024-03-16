-- htmltag.lua
-- Copyright (C) 2023 Posit Software, PBC

_quarto.ast.add_handler({

  -- empty table so this handler is only called programmatically
  class_name = {},

  -- the name of the ast node, used as a key in extended ast filter tables
  ast_name = "HtmlTag",

  -- float crossrefs are always blocks
  kind = "Block",

  parse = function(div)
    -- luacov: disable
    internal_error()
    -- luacov: enable
  end,

  slots = { "content" },

  constructor = function(tbl)
    if tbl.attr then
      tbl.identifier = tbl.attr.identifier
      tbl.classes = tbl.attr.classes
      tbl.attributes = as_plain_table(tbl.attr.attributes)
      tbl.attr = nil
    end
    tbl.classes = tbl.classes or {}
    tbl.attributes = tbl.attributes or {}
    tbl.identifier = tbl.identifier or ""
    tbl.content = pandoc.Div(tbl.content or {})
    return tbl
  end
})

_quarto.ast.add_renderer("HtmlTag", function(_) return true end,
function(tag)
  local div = pandoc.Blocks({})
  local result = div
  local result_attrs = {
    class = table.concat(tag.classes, " "),
  }
  if tag.identifier ~= nil and tag.identifier ~= "" then
    result_attrs.id = tag.identifier
  end
  for k, v in pairs(tag.attributes) do
    result_attrs[k] = v
  end
  local attr_string = {}
  for k, v in spairs(result_attrs) do
    table.insert(attr_string, k .. "=\"" .. html_escape(v, true) .. "\"")
  end
  result:insert(pandoc.RawBlock("html", "<" .. tag.name .. " " .. table.concat(attr_string, " ") .. ">"))
  result:extend(tag.content.content) 
  result:insert(pandoc.RawBlock("html", "</" .. tag.name .. ">"))

  return div
end)