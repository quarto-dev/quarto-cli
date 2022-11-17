-- svg.lua
-- Copyright (C) 2021 by RStudio, PBC

local function convert_svg(path)
  local stem = pandoc.path.split_extension(path)
  local output = stem .. '.pdf'
  local result = os.execute("rsvg-convert -f pdf -a -o" .. output .. " " .. path)
  if result then
    return output
  else 
    error("Failed when attempting to convert a SVG to a PDF for output. Please ensure that rsvg-convert is available on the path.")
    os.exit(1)
  end
end

function svg() 
  return {
    -- convert SVG images to PDF when rendering PDFS
    Image = function(image)
      if quarto.doc.is_format("pdf") then
        if _quarto.file.exists(image.src) then
          local ext = select(2, pandoc.path.split_extension(image.src))
          if ext == '.svg' then
            local converted = convert_svg(image.src)
            if converted then
              image.src = converted
              return image
            end
          end
        else
          -- take a look in the media bag
          local mt, contents = pandoc.mediabag.lookup(image.src)
          if mt == 'image/svg+xml' then
            local result = pandoc.system.with_temporary_directory('svg-convert', function (tmpdir) 

              -- write the media bag contents to a temp file
              local filename = image.src
              local tempPath = pandoc.path.join({tmpdir, filename})
              local file = _quarto.file.write(tempPath, contents)
              
              if file then
                -- convert to svg
                local convertedPath = convert_svg(tempPath)
                if convertedPath then
                  -- compute the correct relative path to the newly created file
                  local mbPath = pandoc.path.make_relative(convertedPath, tmpdir, false)
                  local mbContents = _quarto.file.read(convertedPath)
                  
                  -- place the new file in the mediabag, remove the old
                  pandoc.mediabag.insert(mbPath, 'application/pdf', mbContents)
                  pandoc.mediabag.delete(filename)

                  -- update the path
                  image.src = mbPath
                  return image
                end
              end
              return nil
            end)
            return result
          end
        end
      end
    end
  }
end

