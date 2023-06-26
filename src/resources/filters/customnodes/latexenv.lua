-- latexenv.lua
-- Copyright (C) 2023 Posit Software, PBC

_quarto.ast.add_handler({

  -- empty table so this handler is only called programmatically
  class_name = {},

  -- the name of the ast node, used as a key in extended ast filter tables
  ast_name = "LatexEnvironment",

  kind = "Block",

  parse = function(div)
    fail("LatexEnvironment nodes should not be parsed")
  end,

  slots = { "content" },

  constructor = function(tbl)
    -- if tbl.attr then
    --   tbl.identifier = tbl.attr.identifier
    --   tbl.classes = tbl.attr.classes
    --   tbl.attributes = as_plain_table(tbl.attr.attributes)
    --   tbl.attr = nil
    -- end
    -- tbl.classes = tbl.classes or {}
    -- tbl.attributes = tbl.attributes or {}
    -- tbl.identifier = tbl.identifier or ""
    tbl.content = pandoc.Div(tbl.content or {})
    return tbl
  end
})

_quarto.ast.add_renderer("LatexEnvironment", function(_) return true end,
function(env)
  local result = pandoc.Blocks({})
  result:insert(latexBeginEnv(env.name, env.pos))
  result:extend(env.content.content) 
  result:insert(pandoc.RawBlock("latex-merge", "\\end{" .. env.name .. "}%"))
  return result
end)