-- resolve_scoped_elements.lua
-- Copyright (C) 2023 Posit Software, PBC

function resolve_scoped_elements()
  local resolve_table_colwidths_scoped = require("modules/tablecolwidths").resolve_table_colwidths_scoped

  local scoped_filter = {
    Table = resolve_table_colwidths_scoped
  }
  return {
    -- because our emulated filter has a special case for Pandoc documents
    -- which doesn't create copies, we don't need to return doc here
    Pandoc = function(doc)
      _quarto.ast.scoped_walk(doc.blocks, scoped_filter)
    end
  }
end