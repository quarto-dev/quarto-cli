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

      local table_responsive_nm = {
        ["responsive"    ]       = "table-responsive"    ,
        ["responsive-sm" ]       = "table-responsive-sm" ,
        ["responsive-md" ]       = "table-responsive-md" ,
        ["responsive-lg" ]       = "table-responsive-lg" ,
        ["responsive-xl" ]       = "table-responsive-xl" ,
        ["responsive-xxl"]       = "table-responsive-xxl",
        ["table-responsive"    ] = "table-responsive"    ,
        ["table-responsive-sm" ] = "table-responsive-sm" ,
        ["table-responsive-md" ] = "table-responsive-md" ,
        ["table-responsive-lg" ] = "table-responsive-lg" ,
        ["table-responsive-xl" ] = "table-responsive-xl" ,
        ["table-responsive-xxl"] = "table-responsive-xxl"
      }

      local found, found_key
      for _, v in ipairs(tbl.classes) do
        if table_responsive_nm[v] then
          found = table_responsive_nm[v]
          found_key = v
          break
        end
      end
      if not found then
        return tbl
      end

      tbl.classes = tbl.classes:filter(function(class) 
        return class ~= found_key 
      end)
        
      return pandoc.Div(tbl, pandoc.Attr("", { found }))
    end
  }
end
