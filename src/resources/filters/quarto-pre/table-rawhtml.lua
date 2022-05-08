-- table-rawhtml.lua
-- Copyright (C) 2020 by RStudio, PBC

-- flextable outputs consecutive html blocks so we merge them
-- back together here so they can be processed by ourraw  table
-- caption handling
function tableMergeRawHtml()
  if isHtmlOutput() then
    return {
      Blocks = function(blocks)
        local pendingRaw = ''
        local merged = pandoc.List()
        for i,el in ipairs(blocks) do
          if isRawHtml(el) and el.text:find(htmlTableTagNamePattern()) then
            pendingRaw = pendingRaw .. "\n" .. el.text
          else
            if #pendingRaw > 0 then
              merged:insert(pandoc.RawBlock("html", pendingRaw))
              pendingRaw = ''
            end
            merged:insert(el)
          end
        end
        if #pendingRaw > 0 then
          merged:insert(pandoc.RawBlock("html", pendingRaw))
        end
        return merged
      end
    }
  else
    return {

    }
  end
end


function tableRenderRawHtml() 
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