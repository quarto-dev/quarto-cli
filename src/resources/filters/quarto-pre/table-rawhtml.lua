-- table-rawhtml.lua
-- Copyright (C) 2020 by RStudio, PBC

function tableRawhtml() 
  return {
    RawBlock = function(el)
      if isRawHtml(el) then
        -- if we have a raw html table in a format that doesn't handle raw_html
        -- then have pandoc parse the table into a proper AST table block
        if not isHtmlOutput() and not isMarkdownWithHtmlOutput() and not isIpynbOutput() then
          local tableBegin,tableBody,tableEnd = el.text:match(htmlTablePattern())
          if tableBegin then
            local tableHtml = tableBegin .. "\n" .. tableBody .. "\n" .. tableEnd
            local tableDoc = pandoc.read(tableHtml, "html")
            return tableDoc.blocks[1]
          end
        end
      end
    end
  }
end