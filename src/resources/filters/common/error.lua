-- debug.lua
-- Copyright (C) 2020 by RStudio, PBC





function fail(message)
  local file = currentFile()
  if file then
    print("An error occurred while processing '" .. file .. "'")
  else
    print("An error occurred")
  end
  print(message)
  os.exit(1)
end


function currentFile() 
  
  if currentFileMetadataState ~= nil then
    -- if we're in a multifile contatenated render, return which file we're rendering
    local fileState = currentFileMetadataState()
    if fileState ~= nil and fileState.file ~= nil and fileState.file.bookItemFile ~= nil then
      return fileState.file.bookItemFile
    elseif fileState ~= nil and fileState.include_directory ~= nil then
      return fileState.include_directory
    else
      return nil
    end
  else
    -- if we're not in a concatenated scenario, file name doesn't really matter since the invocation is only
    -- targeting a single file
    return nil
  end
end