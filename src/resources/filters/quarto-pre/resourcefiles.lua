-- resourcefiles.lua
-- Copyright (C) 2020 by RStudio, PBC

function resourceFiles() 
  return {
    -- TODO: discover resource files
    -- Note that currently even if we discover resourceFiles in markdown they don't 
    -- actually register for site preview b/c we don't actually re-render html
    -- files for preview if they are newer than the source files. we may need to
    -- record discovered resource files in some sort of index in order to work 
    -- around this
  }
end

-- function to record a file resource
function recordFileResource(res)
  preState.results.resourceFiles:insert(res)
end


