

function outputs()
  return {
    
    -- unroll output divs for formats (like pptx) that don't support them
    Blocks = function(blocks)
      
      -- if we don't support output divs then we need to unroll them
      if not param("output-divs", true) then
        blocks = filterOutputDivs(blocks)
      end
      
      return blocks
    end
  }
end


function filterOutputDivs(blocks)
  local filtered = pandoc.List:new()
  for _,block in ipairs(blocks) do
    -- find cells
    if block.t == "Div" and tcontains(block.attr.classes, "cell") then
      
      -- if this is PowerPoint and it's a figure panel then let it through (as
      -- we'll use PowerPoint columns to layout at least 2 figures side-by-side)
      if isPowerPointOutput() and hasLayoutAttributes(block) then
        filtered:insert(block)
      else
        -- unroll blocks contained in divs
        for _, childBlock in ipairs(block.content) do
          if childBlock.t == "Div" then
            tappend(filtered, childBlock.content)
          else
            filtered:insert(childBlock)
          end
        end
      end
    else 
      filtered:insert(block)
    end
  end
  return filtered
end