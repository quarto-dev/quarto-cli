-- resourcefiles.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

function resourceFiles() 
  return {
    -- TODO: discover resource files
    -- Note that currently even if we discover resourceFiles in markdown they don't 
    -- actually register for site preview b/c we don't actually re-render html
    -- files for preview if they are newer than the source files. we may need to
    -- record discovered resource files in some sort of index in order to work 
    -- around this
    Image = function(el)
      local targetPath = el.src
      if not targetPath:match('^https?:') and not targetPath:match('^data:') then
        -- don't include this resource if it is a URL, data file or some not file path
        if pandoc.path.is_relative(targetPath) then 
          local inputDir = pandoc.path.directory(quarto.doc.input_file)
          targetPath = pandoc.path.join({inputDir, el.src})
        end
        recordFileResource(el.src)
      end
    end,
  }
end

-- function to record a file resource
function recordFileResource(res)
  preState.results.resourceFiles:insert(res)
end


