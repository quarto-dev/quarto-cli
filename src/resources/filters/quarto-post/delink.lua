-- delink.lua
-- Copyright (C) 2021-2022 Posit Software, PBC

local kDelinkClass = require("../modules/constants").kDelinkClass

function delink() 
  return {
    -- Removes links from any divs marked with 'delink' class
    Div = function(div)
      if _quarto.format.isHtmlOutput() and div.attr.classes:includes(kDelinkClass) then

        -- remove the delink class 
        for i, clz in ipairs(div.attr.classes) do 
          if clz == kDelinkClass then
            div.attr.classes:remove(i)
          end
        end

        -- find links and transform them to spans
        -- this is in post, so it's after render, so we don't need to worry about
        -- custom ast nodes
        return pandoc.walk_block(div, {
          Link = function(link)
            return pandoc.Span(link.content)
          end
        })
      end
    end
  }
end
