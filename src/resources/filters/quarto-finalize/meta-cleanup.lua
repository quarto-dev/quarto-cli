-- meta-cleanup.lua
-- Copyright (C) 2022-2023 Posit, PBC

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