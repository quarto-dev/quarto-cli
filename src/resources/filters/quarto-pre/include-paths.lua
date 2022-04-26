-- include-paths.lua
--
-- fixes paths from <include> directives
--
-- Copyright (C) 2022 by RStudio, PBC

function includePaths() 
  return {
    Link = function(el)
      local file = currentFileMetadataState().file
      if file ~= nil and file.include_directory ~= nil then
        print(el.target, file.include_directory)
        el.target = resourceRef(el.target, file.include_directory)
      end
      return el
    end,

    Image = function(el)
      local file = currentFileMetadataState().file
      if file ~= nil and file.include_directory ~= nil then 
        el.src = resourceRef(el.src, file.include_directory)
      end
      return el
    end,

    RawInline = handleRawElementIncludePath,
    RawBlock = handleRawElementIncludePath,
  }
end


function handleRawElementIncludePath(el)
  if isRawHtml(el) then
    local file = currentFileMetadataState().file
    if file ~= nil and file.include_directory ~= nil then
      handlePaths(el, file.include_directory)
    end
    return el
  end
end
