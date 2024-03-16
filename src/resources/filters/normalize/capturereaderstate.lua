-- extractquartodom.lua
-- Copyright (C) 2023 Posit Software, PBC

local readqmd = require("readqmd")

function normalize_capture_reader_state() 
  return {
    Meta = function(meta)
      quarto_global_state.reader_options = readqmd.meta_to_options(meta.quarto_pandoc_reader_opts)
      meta.quarto_pandoc_reader_opts = nil
      return meta
    end
  }
end
