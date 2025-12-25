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
              quarto_global_state.usingBookmark = true
              local bookmarkReset = pandoc.Div({
                pandoc.RawInline('latex', '\\bookmarksetup{startatroot}\n'),
                el
              })
              return bookmarkReset
            end
          end

          -- handle typst "part" and "appendix" headers
          if el.level == 1 and _quarto.format.isTypstOutput() then
            if bookItemType == "part" then
              -- Emit #part() function call (imported from orange-book)
              local partBlock = pandoc.RawBlock('typst', '#part[' .. pandoc.utils.stringify(el.content) .. ']')
              return partBlock
            elseif bookItemType == "appendix" then
              -- Switch to appendix mode with alphabetic numbering
              -- First appendix triggers the show rule with localized "Appendices" title
              if file.bookItemNumber == 1 or file.bookItemNumber == nil then
                local language = param("language", nil)
                local appendicesTitle = language and language["section-title-appendices"] or "Appendices"
                -- Use hide-parent: true to work around orange-book bug where unnumbered headings
                -- (like Bibliography) trigger duplicate "Appendices" TOC entries.
                -- See plans/orange-emitting-multiple-appendices.md for details.
                local appendixStart = pandoc.RawBlock('typst',
                  '#show: appendices.with("' .. appendicesTitle .. '", hide-parent: true)')

                -- If this is the synthetic "Appendices" divider heading (has .unnumbered class),
                -- emit our own Appendices heading for TOC display (since hide-parent: true
                -- means orange-book won't add one automatically).
                if el.classes:includes("unnumbered") then
                  local appendicesHeading = pandoc.RawBlock('typst',
                    '#heading(level: 1, numbering: none)[' .. appendicesTitle .. ']')
                  return {appendixStart, appendicesHeading}
                end

                return {appendixStart, el}
              end
              return el
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
