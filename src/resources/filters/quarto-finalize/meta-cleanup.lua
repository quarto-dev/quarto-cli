-- meta-cleanup.lua
-- Copyright (C) 2022 by RStudio, PBC

function metaCleanup()
  return {
    Meta = function(meta)
      if _quarto.format.isAstOutput() then
        removeAllEmptyIncludes(meta)
        return meta
      end
    end
  }
end