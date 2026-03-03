-- book-cleanup.lua
-- Copyright (C) 2020-2022 Posit Software, PBC


function bookCleanup() 
  if (param("single-file-book", false)) then
    return {
      RawInline = cleanupFileMetadata,
      RawBlock = cleanupFileMetadata,
      Div = cleanupBookPart,
      Para = cleanupEmptyParas
    }
  else
    return {
      RawInline = cleanupFileMetadata,
      RawBlock = cleanupFileMetadata,
      Para = cleanupEmptyParas
    }
  end
end

function cleanupEmptyParas(el)
  if not next(el.content) then
    return {}
  end  
end

function cleanupFileMetadata(el)
  if _quarto.format.isRawHtml(el) then
    local rawMetadata = string.match(el.text, "^<!%-%- quarto%-file%-metadata: ([^ ]+) %-%->$")
    if rawMetadata then
      return {}
    end
  end
  return el
end

function cleanupBookPart(el)
  if el.attr.classes:includes('quarto-book-part') then
    if _quarto.format.isLatexOutput() then
      -- Keep div for LaTeX (Pandoc's LaTeX writer handles divs without issue)
      return el
    elseif _quarto.format.isTypstOutput() then
      -- Unwrap content for Typst to avoid #block[] wrapper that breaks pagebreak()
      -- The content is already transformed to #part[...] by book-numbering.lua
      return el.content
    else
      -- Remove for other formats (HTML etc.) that don't support parts
      return pandoc.Div({})
    end
  end
end

