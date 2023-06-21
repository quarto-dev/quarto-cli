-- latexcmd.lua
-- Copyright (C) 2023 Posit Software, PBC

_quarto.ast.add_handler({

  -- empty table so this handler is only called programmatically
  class_name = {},

  -- the name of the ast node, used as a key in extended ast filter tables
  ast_name = "LatexCommand",

  kind = "Block",

  parse = function(div)
    fail("LatexCommand nodes should not be parsed")
  end,

  slots = { "arg", "opt_arg" },

  constructor = function(tbl)
    return tbl
  end
})

_quarto.ast.add_renderer("LatexCommand", function(_) return true end,
function(cmd)
  local result = pandoc.Inlines({}) -- feels safer than Inlines({})
  result:insert(pandoc.RawInline("latex", "\\" .. cmd.name))
  local opt_arg = cmd.opt_arg
  if opt_arg then
    result:insert(pandoc.RawInline("latex", "["))
    if opt_arg.content then
      result:extend(opt_arg.content)
    else
      result:insert(opt_arg)
    end
    result:insert(pandoc.RawInline("latex", "]"))
  end
  local arg = cmd.arg
  if arg then
    result:insert(pandoc.RawInline("latex", "{"))
    if arg.content then
      result:extend(arg.content)
    else
      result:insert(arg)
    end
    result:insert(pandoc.RawInline("latex", "}"))
  end
  return pandoc.Plain(result)
end)