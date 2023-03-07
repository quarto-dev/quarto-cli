-- tableattributes.lua
-- Copyright (C) 2020-2023 Posit Software, PBC

function table_classes_and_attributes()
  return {
    Table = function(table)
      local caption, attr = parseCaption(table)
      -- make the appropriate forwards to the table element itself
      table.caption = createTableCaption(caption, attr)
      return table
    end
  }
end