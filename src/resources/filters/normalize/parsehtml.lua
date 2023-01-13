function parse_html_tables()
  return {
    RawBlock = function(el)
      if _quarto.format.isRawHtml(el) then
        -- if we have a raw html table in a format that doesn't handle raw_html
        -- then have pandoc parse the table into a proper AST table block
        local tableBegin,tableBody,tableEnd = el.text:match(htmlTablePattern())
        if tableBegin then
          local tableHtml = tableBegin .. "\n" .. tableBody .. "\n" .. tableEnd
          local tableDoc = pandoc.read(tableHtml, "html")
          return tableDoc.blocks
        end
      end
      return el
    end
  }
end