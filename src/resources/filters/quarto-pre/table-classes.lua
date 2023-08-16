-- table-classes.lua
-- Copyright (C) 2020-2023 Posit Software, PBC

-- handle classes to pass to `<table>` element
function table_classes()
  return {
    FloatCrossref = function(float)
      local kind = refType(float.identifier)
      if kind ~= "tbl" then
        return nil
      end

      if float.caption_long == nil or (#float.caption_long.content and #float.caption_long.content < 1) then
        return nil
      end

      -- recognized Bootstrap table classes
      local table_bootstrap_nm = {
        "primary", "secondary", "success", "danger", "warning", "info", "light", "dark",
        "striped", "hover", "active", "bordered", "borderless", "sm",
        "responsive", "responsive-sm", "responsive-md", "responsive-lg", "responsive-xl", "responsive-xxl"
      }

      local caption_content = float.caption_long.content
      local caption_parsed, attr = parseTableCaption(caption_content)
      caption_content[#caption_content] = pandoc.Plain(createTableCaption(caption_parsed, attr))

      -- determine if we have any supplied classes, these should always begin with a `.` and
      -- consist of alphanumeric characters
      local normalize_class = function(x)
        if tcontains(table_bootstrap_nm, x) then
          return "table-" .. x
        else
          return x
        end
      end
      local normalized_classes = attr.classes:map(normalize_class)

      local function process_table(tbl)
        -- ensure that classes are appended (do not want to rewrite and wipe out any existing)
        tbl.classes:extend(normalized_classes)
        -- if we have a `sm` table class then we need to add the `small` class
        -- and if we have a `small` class then we need to add the `table-sm` class
        if tcontains(normalized_classes, "table-sm") then
          tbl.classes:insert("small")
        elseif tcontains(normalized_classes, "small") then
          tbl.classes:insert("table-sm")
        end

        -- now, forward bootstrap classes from float to table
        for _, class in ipairs(attr.classes) do
          if tcontains(table_bootstrap_nm, class) then
            tbl.classes:insert("table-" .. class)
          end
          -- if we have a `sm` table class then we need to add the `small` class
          -- and if we have a `small` class then we need to add the `table-sm` class
          if class == "table-sm" then
            tbl.classes:insert("small")
          elseif class == "small" then
            tbl.classes:insert("table-sm")
          end
        end
        return tbl
      end

      if float.content.t == "Table" then
        float.content = process_table(float.content)
      else
        float.content = _quarto.ast.walk(float.content, {
          FloatCrossref = function()
            return nil, false -- do not descend into subfloats
          end,
          Table = process_table
        })
      end

      attr.classes = pandoc.List()

      caption_content[#caption_content] = nil
      float.caption_long.content = createTableCaption(caption_parsed, attr)
      return float
    end
  }

end
