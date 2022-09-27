-- dependencies.lua
-- Copyright (C) 2020 by RStudio, PBC



function dependencies()
  return {
    Meta = function(meta) 
      -- Process the final dependencies into metadata
      -- and the file responses
      _quarto.processDependencies(meta)
      return meta
    end,
    Pandoc = function(doc)
      local out = pandoc.write(doc, "json")
      local f = io.open("dependencies-main.json", "w")
      if f ~= nil then
        f:write(out)
        f:close()
      end
    end,
  }
end
