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

function escapeHeaders(blocks) 

  local baseHeadingLevel = 10000
  if contents ~= nil then
    _quarto.ast.walk(blocks, {
      Header = function(el)
        baseHeadingLevel = math.min(el.level, baseHeadingLevel)
      end
    })
  end
  local headingOffset = math.max(math.min(4 - baseHeadingLevel, 10000), 0)

  return _quarto.ast.walk(blocks, {
      Header = function(header)
        local level = math.min(header.level + headingOffset, 6)
        local headerClz = "h" .. level;
        return pandoc.Div(header.content, pandoc.Attr("", {headerClz}))    
    end
  })
end



-- Provides a list of element identifiers that are within the 
-- given element
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
  findChildDiv = findChildDiv,
  escapeHeaders = escapeHeaders
}
