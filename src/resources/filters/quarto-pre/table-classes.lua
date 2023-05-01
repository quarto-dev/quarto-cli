-- table-classes.lua
-- Copyright (C) 2020-2023 Posit Software, PBC

-- handle classes to pass to `<table>` element
function table_classes()
  return {
   
    Table = function(tbl)
      
      -- if there is no caption then return tbl unchanged
      if tbl.caption.long == nil or #tbl.caption.long < 1 then
        return tbl
      end

      -- generate a table containing recognized Bootstrap table classes
      local table_bootstrap_nm = {
        "primary", "secondary", "success", "danger", "warning", "info", "light", "dark",
        "striped", "hover", "active", "bordered", "borderless", "sm",
        "responsive", "responsive-sm", "responsive-md", "responsive-lg", "responsive-xl", "responsive-xxl"
      }

      -- determine if we have any supplied classes, these should always begin with a `.` and
      -- consist of alphanumeric characters
      local caption = tbl.caption.long[#tbl.caption.long]

      local caption_parsed, attr = parseTableCaption(pandoc.utils.blocks_to_inlines({caption}))

      local normalize_class = function(x)
        if tcontains(table_bootstrap_nm, x) then
          return "table-" .. x
        else
          return x
        end
      end
      local normalized_classes = attr.classes:map(normalize_class)

      -- ensure that classes are appended (do not want to rewrite and wipe out any existing)
      tbl.classes:extend(normalized_classes)

      -- if we have a `sm` table class then we need to add the `small` class
      -- and if we have a `small` class then we need to add the `table-sm` class
      if tcontains(normalized_classes, "table-sm") then
        tbl.classes:insert("small")
      elseif tcontains(normalized_classes, "small") then
        tbl.classes:insert("table-sm")
      end

      attr.classes = pandoc.List()

      tbl.caption.long[#tbl.caption.long] = pandoc.Plain(createTableCaption(caption_parsed, attr))

      return tbl
    end
  }

end
