-- include-paths.lua
--
-- fixes paths from <include> directives
--
-- Copyright (C) 2022 Posit Software, PBC

function include_paths() 
  return {
    Link = function(el)
      local file = currentFileMetadataState().file
      if file ~= nil and file.include_directory ~= nil then
        el.target = fixIncludePath(el.target, file.include_directory)
      end
      return el
    end,

    Image = function(el)
      local file = currentFileMetadataState().file
      if file ~= nil and file.include_directory ~= nil then 
        el.src = fixIncludePath(el.src, file.include_directory)
      end
      return el
    end,

    RawInline = handleRawElementIncludePath,
    RawBlock = handleRawElementIncludePath,
  }
end


function handleRawElementIncludePath(el)
  if _quarto.format.isRawHtml(el) then
    local file = currentFileMetadataState().file
    if file ~= nil and file.include_directory ~= nil then
      handlePaths(el, file.include_directory, fixIncludePath)
    end
    return el
  end
end
