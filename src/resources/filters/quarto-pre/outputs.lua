

function outputs()
  -- the param("output-divs", true) check is now done in flags.lua

  return {
    -- unroll output divs for formats (like pptx) that don't support them
    Div = function(div)

      -- if we don't support output divs then we need to unroll them
      if tcontains(div.attr.classes, "cell") then
        -- if this is PowerPoint and it's a figure panel then let it through (as
        -- we'll use PowerPoint columns to layout at least 2 figures side-by-side)
        if _quarto.format.isPowerPointOutput() and hasLayoutAttributes(div) then
          return nil
        end

        -- unroll blocks contained in divs
        local blocks = pandoc.List()
        for _, childBlock in ipairs(div.content) do
          if childBlock.t == "Div" then
            tappend(blocks, childBlock.content)
          else
            blocks:insert(childBlock)
          end
        end
    
        return blocks
      end
    end
  }
end
