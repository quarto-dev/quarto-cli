-- customwriter.lua
-- filter to output the result of custom quarto writers
--
-- Copyright (C) 2022 by RStudio, PBC

function Writer(docs)
  -- quarto's custom writers output a single RawBlock with the string content.
  -- we simply output that.
  return docs.blocks[1].text
end
