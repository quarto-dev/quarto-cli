function parseExtendedNodes() 
  return {
    Div = function(div)
      local tag = pandoc.utils.stringify(div.attr.classes)
      local handler = quarto.ast.resolveHandler(tag)
      if handler == nil then
        return div
      end
      local divTable = handler.parse(div)

      -- now that we're running in pandoc emulation, we don't need to build
      -- return quarto.ast.build(tag, divTable)
      -- instead, we make this into an extended ast node

      divTable["-is-extended-ast-"] = true
      divTable["-quarto-internal-type-"] = divTable.class

      return quarto.ast.copyAsExtendedNode(divTable)
    end
  }
end