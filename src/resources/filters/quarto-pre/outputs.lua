

function unroll_cell_outputs()
  -- the param("output-divs", true) check is now done in flags.lua

  local function has_ojs_content(div)
    local ojs_content = false
    _quarto.ast.walk(div, {
      Div = function(el)
        if el.identifier:match("ojs%-cell%-") then
          ojs_content = true
        end
      end
    })
    return ojs_content
  end

  return {
    -- unroll output divs for formats (like pptx) that don't support them
    Div = function(div)

      -- if we don't support output divs then we need to unroll them
      if tcontains(div.attr.classes, "cell") then
        -- if this is PowerPoint and it's a figure panel then let it through (as
        -- we'll use PowerPoint columns to layout at least 2 figures side-by-side)
        if (_quarto.format.isPowerPointOutput() and hasLayoutAttributes(div)) or
           (_quarto.format.isHugoMarkdownOutput() and has_ojs_content(div)) then
          return nil
        end

        -- unroll blocks contained in divs
        local blocks = pandoc.List()
        for _, childBlock in ipairs(div.content) do
          if is_regular_node(childBlock, "Div") and not is_custom_node(childBlock) then
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
