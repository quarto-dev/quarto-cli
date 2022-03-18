-- output-location.lua
-- Copyright (C) 2021 by RStudio, PBC

function outputLocation()
  if isSlideOutput() then
    return {
      Pandoc = function(doc)

        local blocks = doc.blocks
        local newBlocks = pandoc.List()
        for _,block in pairs(doc.blocks) do
          -- is this a cell block w/ output-location attribute?
          if block.attr.classes:includes("cell") then
            local outputLoc = block.attr.attributes["output-location"]
            block.attr.attributes["output-location"] = nil
            if outputLoc == "fragment" then
              newBlocks:insert(fragmentOutputLocation(block))
            else
              newBlocks:insert(block)
            end
          else
            newBlocks:insert(block)
          end
        end
        doc.blocks = newBlocks
        return doc
      end
    }
  else
    return {}
  end
 
end


function fragmentOutputLocation(block)
  return pandoc.walk_block(block, {
    Div = function(el)
      el.attr.classes:insert("fragment")
      return el
    end
  })
end



