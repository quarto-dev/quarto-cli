-- file-metadata.lua
-- Copyright (C) 2020 by RStudio, PBC


fileMetadataState = {
  file = nil,
  appendix = false,
}


function fileMetadata() 
  return {
    RawInline = parseFileMetadata,
    RawBlock = parseFileMetadata
  }
end

function parseFileMetadata(el)
  if isRawHtml(el) then
    local rawMetadata = string.match(el.text, "^<!%-%- quarto%-file%-metadata: ([^ ]+) %-%->$")
    if rawMetadata then
      local decoded = base64_decode(rawMetadata)
      local file = jsonDecode(decoded)
      fileMetadataState.file = file
      -- flip into appendix mode as appropriate
      if file.bookItemType == "appendix" then
        fileMetadataState.appendix = true
      end
    end
  end
  return el
end

function currentFileMetadataState()
  return fileMetadataState
end

