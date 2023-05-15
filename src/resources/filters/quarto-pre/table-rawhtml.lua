-- table-rawhtml.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- flextable outputs consecutive html blocks so we merge them
-- back together here so they can be processed by ourraw table
-- caption handling

local patterns = require("modules/patterns")

function table_merge_raw_html()
  if not _quarto.format.isHtmlOutput() then
    return {}
  end

  return {
    Blocks = function(blocks)
      local pendingRaw = ''
      local merged = pandoc.List()
      for i,el in ipairs(blocks) do
        if _quarto.format.isRawHtml(el) and el.text:find(patterns.html_table_tag_name) then
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
end

-- re-emits GT's CSS with lower specificity
function respecifyGtCSS(text)
  local s, e, v = text:find('<div id="([a-z]+)"')
  -- if gt does not emit a div, do nothing
  if v == nil then
    return text
  end
  return text:gsub("\n#" .. v, "\n:where(#" .. v .. ")")
end

function table_render_raw_html()
  return {
    RawBlock = function(el)
      if hasGtHtmlTable(el) then
        el.text = respecifyGtCSS(el.text)
      end
      if _quarto.format.isRawHtml(el) then
        -- if we have a raw html table in a format that doesn't handle raw_html
        -- then have pandoc parse the table into a proper AST table block
        if not _quarto.format.isHtmlOutput() and not _quarto.format.isMarkdownWithHtmlOutput() and not _quarto.format.isIpynbOutput() then
          local tableBegin,tableBody,tableEnd = el.text:match(htmlTablePattern())
          if tableBegin then
            local tableHtml = tableBegin .. "\n" .. tableBody .. "\n" .. tableEnd
            local tableDoc = pandoc.read(tableHtml, "html")
            return tableDoc.blocks
          end
        end
      end
      return el
    end
  }
end