-- qmd-reader.lua
-- A Pandoc reader for Quarto Markdown
-- 
-- Copyright (C) 2023 by RStudio, PBC

local readqmd = require("readqmd")

function Reader (inputs, opts)
  -- the custom Pandoc reader apparently runs on a different Lua context than the
  -- other filters, so we cannot use global state to share the options.
  -- as a result, we'll inject the options into the document metadata
  -- and extract it later.
  local result = readqmd.readqmd(tostring(inputs), opts)

  result.meta.quarto_pandoc_reader_opts = readqmd.options_to_meta(opts)

  return result
end