-- parse.lua
-- convert custom div inputs to custom nodes
--
-- Copyright (C) 2022 by RStudio, PBC

local function parse(node)
  for _, class in ipairs(node.attr.classes) do
    local tag = pandoc.utils.stringify(class)
    local handler = _quarto.ast.resolve_handler(tag)
    if handler ~= nil then
      return handler.parse(node)
    end
  end
  return node
end

function parse_extended_nodes() 
  return {
    Div = parse,
    Span = parse,
  }
end