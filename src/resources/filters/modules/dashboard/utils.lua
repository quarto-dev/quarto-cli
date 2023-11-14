-- utils.lua
-- Copyright (C) 2020-2022 Posit Software, PBC


-- Finds a child div that matches the given function
function findChildDiv(el, fnMatches) 
  local childDiv
  for i, v in ipairs(el.content) do
    if fnMatches(v) then
      childDiv = v
      break
    end
  end
  return childDiv
end




-- Provides a list of element identifiers that are within the 
-- given element
function idsWithinEl(el)
  local ids = pandoc.List()
  _quarto.ast.walk(el, {
    Block = function(block)
      if block.identifier ~= nil and #block.identifier > 0 then
        ids:insert(block.identifier)
      end
    end,
    Inline = function(inline)
      if inline.identifier ~= nil and #inline.identifier > 0 then
        ids:insert(inline.identifier)
      end
    end
  })
  return ids
end


return {
  idsWithinEl = idsWithinEl,
  findChildDiv = findChildDiv
}
