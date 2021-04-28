-- book.lua
-- Copyright (C) 2020 by RStudio, PBC

function book() 
  return {
    Header = function(el)
      local file = currentFileMetadata()
      if file ~= nil then
        local bookItemType = file.bookItemType
        if bookItemType ~= nil then
          -- handle latex "part" and "appendix" headers
          if el.level == 1 and isLatexOutput() then
            if bookItemType == "part" then
              local partPara = pandoc.Para({
                pandoc.RawInline('latex', '\\part{')
              })
              tappend(partPara.content, el.content)
              partPara.content:insert( pandoc.RawInline('latex', '}'))
              return partPara  
            elseif bookItemType == "appendix" then
              local appendixPara = pandoc.Para({
                pandoc.RawInline('latex', '\\appendix\n\\addcontentsline{toc}{part}{')
              })
              tappend(appendixPara.content, el.content)
              appendixPara.content:insert(pandoc.RawInline('latex', '}'))
              return appendixPara
            end
          end

          -- mark appendix chapters for epub
          if el.level == 1 and isEpubOutput() then
            if preState.appendix == true and bookItemType == "chapter" then
              el.attr.attributes["epub:type"] = "appendix"
            end
          end

          -- index and part cover pages have unnumbered headings, part cover
          -- pages also leave embedded headings unlisted
          if (bookItemType == "index" or bookItemType == "part") then
            el.attr.classes:insert("unnumbered")
            if bookItemType == "part" then
              el.attr.classes:insert("unlisted")
            end
          end

          -- return potentially modified heading el
          return el
        end
      end
    end,

    Div = function(el)
      -- only latex includes explicit book part headings/sections
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