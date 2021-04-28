-- file-metadata.lua
-- Copyright (C) 2020 by RStudio, PBC



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
      preState.file = file
      -- flip into appendix mode as appropriate
      if file.bookItemType == "appendix" then
        preState.appendix = true
      end
      return pandoc.Null()
    end
  end
end

function currentFileMetadata()
  return preState.file
end

