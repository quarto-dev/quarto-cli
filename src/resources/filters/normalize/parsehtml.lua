-- parsehtml.lua
-- Copyright (C) 2020-2023 Posit Software, PBC

local kDisableProcessing = "quarto-disable-processing"

function parse_html_tables()
  return {
    RawBlock = function(el)
      if _quarto.format.isRawHtml(el) then
        -- if we have a raw html table in a format that doesn't handle raw_html
        -- then have pandoc parse the table into a proper AST table block
        local pat = htmlTablePattern()
        local i, j = string.find(el.text, pat)
        if i == nil then
          return nil
        end

        local tableBegin,tableBody,tableEnd = el.text:match(pat)
        if tableBegin then
          local before_table = string.sub(el.text, 1, i - 1)
          local after_table = string.sub(el.text, j + 1)
          local tableHtml = tableBegin .. "\n" .. tableBody .. "\n" .. tableEnd
          local tableDoc = pandoc.read(tableHtml, "html")
          local skip = false
          tableDoc:walk({
            Table = function(table)
              if table.attributes[kDisableProcessing] ~= nil then
                skip = true
              end
            end
          })
          if skip then
            return nil
          end
          local blocks = pandoc.Blocks({})
          if before_table ~= "" then
            blocks:insert(pandoc.RawBlock(el.format, before_table))
          end
          blocks:extend(tableDoc.blocks)
          if after_table ~= "" then
            blocks:insert(pandoc.RawBlock(el.format, after_table))
          end
          return blocks
        end
      end
      return el
    end
  }
end