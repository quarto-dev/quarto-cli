
-- process all equations
function outputs()
  return {
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
    if block.t == "Div" and tcontains(block.attr.classes, "cell") then
      for _, childBlock in ipairs(block.content) do
        if childBlock.t == "Div" then
          tappend(filtered, childBlock.content)
        else
          filtered:insert(childBlock)
        end
      end
    else 
      filtered:insert(block)
    end
  end
  return filtered
end