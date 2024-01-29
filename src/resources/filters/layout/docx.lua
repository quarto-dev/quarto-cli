-- docx.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

function docx_content_fixups(el, align, layoutPercent)
  local width = wpPageWidth()
  return _quarto.ast.walk(el, {
    traverse = "topdown",
    Div = function(div)
      if div.classes:includes("quarto-layout-cell-subref") then
        layoutPercent = horizontalLayoutPercent(div)
        return docx_content_fixups(div, align, layoutPercent), false
      end
    end,
    Image = function(image)
      if width then
        if layoutPercent then
          local inches = (layoutPercent/100) * width
          image.attr.attributes["width"] = string.format("%2.2f", inches) .. "in"
          return image
        end
      end
    end,
    Table = function(tbl)
      if align == "center" then
        -- force widths to occupy 100%
        layoutEnsureFullTableWidth(tbl)
        return tbl
      end
    end
  }) or pandoc.Div({}) -- not necessary but the lua analyzer doesn't know that
end

_quarto.ast.add_renderer("PanelLayout", function(_)
  return _quarto.format.isDocxOutput() or _quarto.format.isOdtOutput()
end, function(layout)
  local rendered_panel
  local div = pandoc.Div({})

  local layout_attr = pandoc.Attr(layout.identifier or "", layout.classes or {}, layout.attributes or {})
  local rows = layout.rows.content:map(function(div) return div.content end)
  if layout.is_float_reftarget then
    decorate_caption_with_crossref(layout.float)
    local float_attr = pandoc.Attr(layout.float.identifier or "", layout.float.classes or {}, layout.float.attributes or {})
    div.attr = merge_attrs(float_attr, layout_attr)

    rendered_panel = tableDocxPanel(div, rows, layout.float.caption_long)
    local align = align_attribute(layout.float)
    rendered_panel = docx_content_fixups(rendered_panel, align)
  else
    div.attr = layout_attr
    rendered_panel = tableDocxPanel(div, rows, nil)
  end 

  local preamble = layout.preamble
  if preamble == nil then
    return rendered_panel
  end
  
  local result = pandoc.Blocks({})
  panel_insert_preamble(result, preamble)
  result:insert(rendered_panel)

  return result
end)



function tableDocxPanel(divEl, layout, caption)
  return tablePanel(divEl, layout, caption, {
    pageWidth = wpPageWidth(),
    rowBreak = docxRowBreak,
    divCaption = docxDivCaption
  })
end


function docxRowBreak()
  return pandoc.RawBlock("openxml", [[
<w:p>
  <w:pPr>
    <w:framePr w:w="0" w:h="0" w:vAnchor="margin" w:hAnchor="margin" w:xAlign="right" w:yAlign="top"/>
  </w:pPr>
</w:p>
]])
end


-- create a native docx caption 
function docxDivCaption(captionEl, align)
  local caption = pandoc.Para({
    pandoc.RawInline("openxml", docxParaStyles(align))
  })
  tappend(caption.content, captionEl.content)
  return caption
end

function docxParaStyles(align)
  local styles = "<w:pPr>\n"
  local captionAlign = docxAlign(align)
  if captionAlign then
    styles = styles .. 
        "<w:jc w:val=\"" .. captionAlign .. "\"/>\n"
  end  
  styles = styles ..
    "<w:spacing w:before=\"200\" />\n" ..
    "<w:pStyle w:val=\"ImageCaption\" />\n" ..
    "</w:pPr>\n"
  return styles
end

function docxAlign(align)
  if align == "left" then
    return "let"
  elseif align == "center" then
    return "center"
  elseif align == "right" then
    return "right"
  else
    return nil
  end
end



