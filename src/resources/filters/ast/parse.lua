-- parse.lua
-- convert custom div inputs to custom nodes
--
-- Copyright (C) 2022 by RStudio, PBC

local function parse(node, kind)
  for _, class in ipairs(node.attr.classes) do
    local tag = pandoc.utils.stringify(class)
    local handler = _quarto.ast.resolve_handler(tag, kind)
    if handler ~= nil then
      return handler.parse(node)
    end
  end
  return node
end

local function parse_inline(node)
  return parse(node, 'Inline')
end

local function parse_block(node)
  return parse(node, 'Block')
end

function parse_extended_nodes() 
  return {
    Div = parse_block,
    Span = parse_inline,
  }
end
