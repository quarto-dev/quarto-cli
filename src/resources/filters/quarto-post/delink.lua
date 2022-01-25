-- delink.lua
-- Copyright (C) 2021 by RStudio, PBC

local kDelinkClass = 'delink'

function delink() 
  return {
    -- Removes links from any divs marked with 'delink' class
    Div = function(div)
      if isHtmlOutput() and div.attr.classes:includes(kDelinkClass) then

        -- remove the delink class 
        for i, clz in ipairs(div.attr.classes) do 
          if clz == kDelinkClass then
            div.attr.classes:remove(i)
          end
        end

        -- find links and transform them to spans
        return pandoc.walk_block(div, {
          Link = function(link)
            return pandoc.Span(link.content)
          end
        })
      end
    end
  }
end
