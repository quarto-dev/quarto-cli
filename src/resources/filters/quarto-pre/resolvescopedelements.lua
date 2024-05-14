-- resolve_scoped_elements.lua
-- Copyright (C) 2023 Posit Software, PBC

function resolve_scoped_elements()
  local resolve_table_colwidths_scoped = require("modules/tablecolwidths").resolve_table_colwidths_scoped

  return {
    traverse = "scoped",
    Table = resolve_table_colwidths_scoped,
  }
end