-- table-rawhtml.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- flextable outputs consecutive html blocks so we merge them
-- back together here so they can be processed by our raw table
-- caption handling

local patterns = require("modules/patterns")

function table_merge_raw_html()
  if not _quarto.format.isHtmlOutput() then
    return {}
  end

  return {
    Blocks = function(blocks)
      local pending_raw = pandoc.List()
      local next_element_idx = 1
      for _, el in ipairs(blocks) do
        if _quarto.format.isRawHtml(el) and
           el.text:find(patterns.html_table_tag_name) then
          pending_raw:insert(el.text)
        else
          if next(pending_raw) then
            blocks[next_element_idx] =
              pandoc.RawBlock("html", table.concat(pending_raw, "\n"))
            pending_raw = pandoc.List()
            next_element_idx = next_element_idx + 1
          end
          blocks[next_element_idx] = el
          next_element_idx = next_element_idx + 1
        end
      end
      if #pending_raw > 0 then
        blocks[next_element_idx] =
          pandoc.RawBlock("html", table.concat(pending_raw, "\n"))
        next_element_idx = next_element_idx + 1
      end
      for i = next_element_idx, #blocks do
        blocks[i] = nil
      end
      return blocks
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

function table_respecify_gt_css()
  return {
    RawBlock = function(el)
      if hasGtHtmlTable(el) then
        el.text = respecifyGtCSS(el.text)
      end
      return el
    end
  }
end
