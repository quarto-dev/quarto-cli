-- table-classes.lua
-- Copyright (C) 2020-2023 Posit Software, PBC

-- handle classes to pass to `<table>` element
function table_classes()

  local function process_table(tbl, normalized_classes)
    -- now, forward classes from float to table
    -- ensure that classes are appended (do not want to rewrite and wipe out any existing)
    tbl.classes:extend(normalized_classes)
    -- if we have a `sm` table class then we need to add the `small` class
    -- and if we have a `small` class then we need to add the `table-sm` class
    if tcontains(normalized_classes, "table-sm") then
      tbl.classes:insert("small")
    elseif tcontains(normalized_classes, "small") then
      tbl.classes:insert("table-sm")
    end

    return tbl
  end

  -- recognized Bootstrap table classes
  local table_bootstrap_nm = {
    "primary", "secondary", "success", "danger", "warning", "info", "light", "dark",
    "striped", "hover", "active", "bordered", "borderless", "sm",
    "responsive", "responsive-sm", "responsive-md", "responsive-lg", "responsive-xl", "responsive-xxl"
  }

  -- determine if we have any supplied classes, these should always begin with a `.` and
  -- consist of alphanumeric characters
  local function normalize_class(x)
    if tcontains(table_bootstrap_nm, x) then
      return "table-" .. x
    else
      return x
    end
  end

  -- the treatment of Table and FloatCrossref is
  -- slightly non-uniform because captions are stored slightly differently
  -- in either case. Cursed code follows...
  return {
    Table = function(tbl)
      -- if there is no caption then return tbl unchanged
      if tbl.caption.long == nil or #tbl.caption.long < 1 then
        return nil
      end

      -- determine if we have any supplied classes, these should always begin with a `.` and
      -- consist of alphanumeric characters
      local caption = tbl.caption.long[#tbl.caption.long]
      local caption_parsed, attr = parseTableCaption(pandoc.utils.blocks_to_inlines({caption}))
      local normalized_classes = attr.classes:map(normalize_class)

      process_table(tbl, normalized_classes)

      attr.classes = pandoc.List()
      tbl.caption.long[#tbl.caption.long] = pandoc.Plain(createTableCaption(caption_parsed, attr))
      return tbl
    end,
    FloatCrossref = function(float)
      local kind = refType(float.identifier)
      if kind ~= "tbl" then
        return nil
      end

      if float.caption_long == nil or (#float.caption_long.content and #float.caption_long.content < 1) then
        return nil
      end

      local caption_content = float.caption_long.content
      local caption_parsed, attr = parseTableCaption(caption_content)
      local normalized_classes = attr.classes:map(normalize_class)

      if float.content.t == "Table" then
        float.content = process_table(float.content, normalized_classes)
      else
        float.content = _quarto.ast.walk(float.content, {
          FloatCrossref = function()
            return nil, false -- do not descend into subfloats
          end,
          Table = function(tbl)
            return process_table(tbl, normalized_classes)
          end
        })
      end

      attr.classes = pandoc.List()
      float.caption_long = pandoc.Plain(createTableCaption(caption_parsed, attr))
      return float
    end
  }

end
