-- book.lua
-- Copyright (C) 2020 by RStudio, PBC

function book() 
  return {
    Header = function(el)
      local file = currentFileMetadata()
      if file ~= nil then
        local bookItemType = file.bookItemType
        if bookItemType ~= nil then
          if bookItemType == "part" and el.level == 1 then
            if isLatexOutput() then
              local partPara = pandoc.Para({
                pandoc.RawInline('latex', '\\part{')
              })
              tappend(partPara.content, el.content)
              partPara.content:insert( pandoc.RawInline('latex', '}'))
              return partPara
            end
          end
          if (bookItemType == "index" or bookItemType == "part") then
            el.attr.classes:insert("unnumbered")
            el.attr.classes:insert("unlisted")
            return el
          end
        end
      end
    end,

    Div = function(el)
      if el.attr.classes:includes('quarto-book-part') then
        if isLatexOutput() then
          return el
        else 
          return pandoc.Div({})
        end
      end
    end
  }
end