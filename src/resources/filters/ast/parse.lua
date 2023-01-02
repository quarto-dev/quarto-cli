-- parse.lua
-- convert custom div inputs to custom nodes
--
-- Copyright (C) 2022 by RStudio, PBC

local function parse(node)
  local tag = pandoc.utils.stringify(node.attr.classes)
  local handler = _quarto.ast.resolve_handler(tag)
  if handler == nil then
    return node
  end
  return handler.parse(node)
end

function parseExtendedNodes() 
  return {
    Div = parse,
    Span = parse,
  }
end