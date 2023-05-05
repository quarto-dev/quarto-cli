-- book-numbering.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

function book_numbering() 
  return {
    Header = function(el)
      local file = currentFileMetadataState().file
      if file ~= nil then
        local bookItemType = file.bookItemType
        local bookItemDepth = file.bookItemDepth
        if bookItemType ~= nil then
          -- if we are in an unnumbered chapter then add unnumbered class
          if bookItemType == "chapter" and file.bookItemNumber == nil then
            el.attr.classes:insert('unnumbered')
          end

          -- handle latex "part" and "appendix" headers
          if el.level == 1 and _quarto.format.isLatexOutput() then
            if bookItemType == "part" then
              local partPara = pandoc.Para({
                pandoc.RawInline('latex', '\\part{')
              })
              tappend(partPara.content, el.content)
              partPara.content:insert( pandoc.RawInline('latex', '}'))
              return partPara  
            elseif bookItemType == "appendix" then
              local appendixPara = pandoc.Para({
                pandoc.RawInline('latex', '\\cleardoublepage\n\\phantomsection\n\\addcontentsline{toc}{part}{')
              })
              tappend(appendixPara.content, el.content)
              appendixPara.content:insert(pandoc.RawInline('latex', '}\n\\appendix'))
              return appendixPara
            elseif bookItemType == "chapter" and bookItemDepth == 0 then
              preState.usingBookmark = true
              local bookmarkReset = pandoc.Div({
                pandoc.RawInline('latex', '\\bookmarksetup{startatroot}\n'),
                el
              })
              return bookmarkReset
            end
          end

          -- mark appendix chapters for epub
          if el.level == 1 and _quarto.format.isEpubOutput() then
            if file.appendix == true and bookItemType == "chapter" then
              el.attr.attributes["epub:type"] = "appendix"
            end
          end

          -- part cover pages have unnumbered headings
          if (bookItemType == "part") then
            el.attr.classes:insert("unnumbered")
          end

          -- return potentially modified heading el
          return el
        end
      end
    end
  }
end
