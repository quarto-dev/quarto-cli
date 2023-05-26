-- rawblock_asis.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

function rawblock_asis()
  return {
    RawBlock = function(raw)
      if raw.format == "asis" then
        return pandoc.RawBlock(FORMAT, raw.text)
      end
    end,
    RawInline = function(raw)
      if raw.format == "asis" then
        return pandoc.RawInline(FORMAT, raw.text)
      end
    end
  }
end