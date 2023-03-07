-- responsive.lua
-- Copyright (C) 2021-2022 Posit Software, PBC

function responsive() 
  return {
    -- make images responsive (unless they have an explicit height attribute)
    Image = function(image)
      if _quarto.format.isHtmlOutput() and param('fig-responsive', false) then
        if not image.attr.attributes["height"] and not image.attr.attributes["data-no-responsive"] then
          image.attr.classes:insert("img-fluid")
          return image
        end
      end
    end
  }
end

function responsive_table()
  return {
    -- make simple HTML tables responsive (if they contain a .responsive(-*) class)
    Table = function(tbl)

      if _quarto.format.isHtmlOutput() == false then
        return tbl
      end

      -- local table_responsive_nm = {
        --   "table-responsive", "responsive", "responsive-sm", "responsive-md", "responsive-lg", "responsive-xl", "responsive-xxl"
        -- }
      
      -- determine if <table> element has any `.responsive` class
      local is_responsive = tbl.classes:includes("table-responsive") or tbl.classes:includes("responsive")      
      
      if is_responsive == false then
        return tbl
      end
        
      -- TODO: check whether the table already has a parent div and the `.responsive-table` class (return tbl if that's the case)

      -- Add parent div with `.table-responsive` class
      return pandoc.Div(tbl, pandoc.Attr("", {"table-responsive"}))
    end
  }
end
