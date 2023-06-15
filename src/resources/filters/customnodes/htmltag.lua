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
    fail("HtmlTag nodes should not be parsed")
  end,

  slots = { "content" },

  constructor = function(tbl)
    if tbl.attr then
      tbl.identifier = tbl.attr.identifier
      tbl.classes = tbl.attr.classes
      tbl.attributes = as_plain_table(tbl.attr.attributes)
      tbl.attr = nil
    end
    return tbl
  end
})

_quarto.ast.add_renderer("HtmlTag", function(_) return true end,
function(tag)
  local result = pandoc.Blocks({})
  local result_attrs = {
    class = table.concat(tag.classes, " "),
    id = tag.identifier,
  }
  for k, v in pairs(tag.attributes) do
    result_attrs[k] = v
  end
  local attr_string = {}
  for k, v in pairs(result_attrs) do
    table.insert(attr_string, k .. "=\"" .. html_escape(v, true) .. "\"")
  end
  result:insert(pandoc.RawBlock("html", "<" .. tag.name .. " " .. table.concat(attr_string, " ") .. ">"))
  local pt = pandoc.utils.type(tag.content)
  if pt == "Blocks" then
    result:extend(tag.content)
  elseif pt == "Inlines" then
    result:insert(pandoc.Plain(tag.content))
  else
    result:insert(tag.content)
  end
  result:insert(pandoc.RawBlock("html", "</" .. tag.name .. ">"))
  return result
end)