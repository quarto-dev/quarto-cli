-- book-cleanup.lua
-- Copyright (C) 2020 by RStudio, PBC


function bookCleanup() 
  if (param("single-file-book", false)) then
    return {
      RawInline = cleanupFileMetadata,
      RawBlock = cleanupFileMetadata,
      Div = cleanupBookPart
    }
  else
    return {
      RawInline = cleanupFileMetadata,
      RawBlock = cleanupFileMetadata,
    }
  end
end

function cleanupFileMetadata(el)
  if isRawHtml(el) then
    local rawMetadata = string.match(el.text, "^<!%-%- quarto%-file%-metadata: ([^ ]+) %-%->$")
    if rawMetadata then
      el.text = ""
    end
  end
  return el
end

function cleanupBookPart(el)
  if el.attr.classes:includes('quarto-book-part') and not isLatexOutput() then
    return pandoc.Div({})
  end
end

