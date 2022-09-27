-- dependencies.lua
-- Copyright (C) 2020 by RStudio, PBC



function dependencies()
  return {
    Meta = function(meta) 
      -- Process the final dependencies into metadata
      -- and the file responses
      _quarto.processDependencies(meta)
      return meta
    end
  }
end
