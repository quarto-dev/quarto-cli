-- latexenv.lua
-- Copyright (C) 2023 Posit Software, PBC

_quarto.ast.add_handler({

  -- empty table so this handler is only called programmatically
  class_name = {},

  -- the name of the ast node, used as a key in extended ast filter tables
  ast_name = "LatexEnvironment",

  kind = "Block",

  parse = function(div)
    internal_error()
  end,

  slots = { "content" },

  constructor = function(tbl)
    tbl.content = pandoc.Div(tbl.content or {})
    return tbl
  end
})

_quarto.ast.add_renderer("LatexEnvironment", function(_) return true end,
function(env)
  local result = pandoc.Blocks({})
  result:insert(latexBeginEnv(env.name, env.pos))
  result:extend(env.content.content or env.content) 
  result:insert(pandoc.RawBlock("latex-merge", "\\end{" .. env.name .. "}%"))
  return result
end)