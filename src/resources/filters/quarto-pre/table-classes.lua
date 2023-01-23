-- table-classes.lua
-- Copyright (C) 2020-2023 Posit Software, PBC

-- helper for checking whether a single value is present in a table
function contains(list, x)
	for _, v in pairs(list) do
		if v == x then return true end
	end
	return false
end

-- propagate table classes to the table's <table> element
function tableTableTag() 
  return {
    Table = function(el)
      if tcontains(el.attr.classes) then
        local tblColwidths = el.attr.attributes[kTblColwidths]
        el.attr.attributes[kTblColwidths] = nil
        if tblColwidths ~= nil then
          return pandoc.walk_block(el, {
            Table = function(tbl)
              tbl.attr.attributes[kTblColwidths] = tblColwidths
              return tbl
            end
          })
        end
      end
    end,
  }
end

-- handle classes to pass to `<table>` element
function tableClasses()

  return {
   
    Table = function(tbl)
      
      -- if there is no caption then return tbl unchanged
      if tbl.caption.long == nil or #tbl.caption.long < 1 then
        return tbl
      end

      -- determine if we have any supplied classes, these should always begin with a `.` and
      -- consist of alphanumeric characters
      local caption =  tbl.caption.long[#tbl.caption.long]
      local caption_str = pandoc.utils.stringify(caption)

      local css_classes = {}

      for css_class in string.gmatch(caption_str, "%.%-?[_a-zA-Z]+[_a-zA-Z0-9-]*") do
        table.insert(css_classes, css_class)
      end
      
      -- if table is empty then return the table unchanged
      if #css_classes < 1 then
        return tbl
      end
      
      -- generate a table containing recognized Bootstrap table classes
      local table_bootstrap_nm = {
        "primary", "secondary", "success", "danger", "warning", "info", "light", "dark",
        "striped", "hover", "active", "bordered", "borderless", "sm",
        "responsive", "responsive-sm", "responsive-md", "responsive-lg", "responsive-xl", "responsive-xxl"
      }

      -- strip off leading `.` chars from each class in `css_classes` and prefix each
      -- item that is recognized as a Bootstrap class with `table-` 
      for k, v in pairs(css_classes) do
        css_classes[k] = string.sub(v, 2)
        if contains(table_bootstrap_nm, css_classes[k]) then
          css_classes[k] = "table-" .. css_classes[k]
        end
      end

      -- insert the table classes
      tbl.attr = pandoc.Attr("", css_classes)

      -- determine the index in which table caption begins
     
      return tbl
    end
  }

end
