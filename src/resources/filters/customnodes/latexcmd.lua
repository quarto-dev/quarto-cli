-- latexcmd.lua
-- Copyright (C) 2023 Posit Software, PBC

_quarto.ast.add_handler({
  class_name = {},
  ast_name = "LatexInlineCommand",
  kind = "Inline",
  -- luacov: disable
  parse = function() internal_error() end,
  -- luacov: enable
  slots = { "arg", "opt_arg" },
  constructor = function(tbl) return tbl end
})

_quarto.ast.add_handler({
  class_name = {},
  ast_name = "LatexBlockCommand",
  kind = "Block",
  -- luacov: disable
  parse = function() internal_error() end,
  -- luacov: enable
  slots = { "arg", "opt_arg" },
  constructor = function(tbl) return tbl end
})

_quarto.ast.add_renderer("LatexInlineCommand", function(_) return true end,
function(cmd)
  local result = pandoc.Inlines({})
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
  return result
end)

_quarto.ast.add_renderer("LatexBlockCommand", function(_) return true end,
function(cmd)
  local result = pandoc.Blocks({})
  local preamble = pandoc.Inlines({})
  local postamble = pandoc.Inlines({})
  preamble:insert(pandoc.RawInline("latex", "\\" .. cmd.name))
  local opt_arg = cmd.opt_arg
  if opt_arg then
    preamble:insert(pandoc.RawInline("latex", "["))
    if opt_arg.content then
      preamble:extend(opt_arg.content)
    else
      preamble:insert(opt_arg)
    end
    preamble:insert(pandoc.RawInline("latex", "]"))
  end
  preamble:insert(pandoc.RawInline("latex", "{"))
  result:insert(pandoc.Plain(preamble))
  local arg = cmd.arg
  if arg then
    local pt = pandoc.utils.type(arg)
    if pt == "Blocks" then
      result:extend(arg)
    elseif pt == "Block" then
      if arg.content then
        result:extend(arg.content)
      else
        result:insert(arg)
      end
    else
      fail_and_ask_for_bug_report("Unexpected type for LatexBlockCommand arg: " .. pt)
      return nil
    end
  end
  postamble:insert(pandoc.RawInline("latex", "}"))
  result:insert(pandoc.Plain(postamble))
  return result
end)