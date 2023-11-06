-- utils.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

function findChildDiv(el, matches) 
  local childDiv
  for i, v in ipairs(el.content) do
    if matches(v) then
      childDiv = v
    end
  end
  return childDiv
end


function idsWithinEl(el)
  local ids = pandoc.List()
  _quarto.ast.walk(el, {
    Block = function(block)
      if block.identifier ~= nil and #block.identifier > 0 then
        ids:insert(el.identifier)
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
