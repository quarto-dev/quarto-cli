-- file-metadata.lua
-- Copyright (C) 2020-2022 Posit Software, PBC


fileMetadataState = {
  file = nil,
  appendix = false,
  include_directory = nil,
}


function file_metadata() 
  return {
    RawInline = parseFileMetadata,
    RawBlock = parseFileMetadata      
  }
end

function parseFileMetadata(el)
  if _quarto.format.isRawHtml(el) then
    local rawMetadata = string.match(el.text, "^<!%-%- quarto%-file%-metadata: ([^ ]+) %-%->$")
    if rawMetadata then
      local decoded = base64_decode(rawMetadata)
      local file = quarto.json.decode(decoded)
      fileMetadataState.file = file
      -- flip into appendix mode as appropriate
      if file.bookItemType == "appendix" then
        fileMetadataState.appendix = true
      end

      -- set and unset file directory for includes
      if file.include_directory ~= nil then
        fileMetadataState.include_directory = file.include_directory
      end
      if file.clear_include_directory ~= nil then
        fileMetadataState.include_directory = nil
      end
    end
  end
  return el
end

function currentFileMetadataState()
  return fileMetadataState
end


function resetFileMetadata()  
  fileMetadataState = {
    file = nil,
    appendix = false,
    include_directory = nil,
  }
end

  
