-- html.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

_quarto.ast.add_renderer("PanelLayout", function(_)
  return _quarto.format.isHtmlOutput()
end, function(panel_layout)
  local panel = pandoc.Div({})

  -- layout
  for i, row in ipairs(panel_layout.rows.content) do    
    local row_div = row
    row_div.attr.classes:insert("quarto-layout-row")
    if panel_layout.valign_class then
      row_div.attr.classes:insert(panel_layout.valign_class)
    end
    for j, cell_div in ipairs(row.content) do
      
      -- add cell class
      cell_div.attr.classes:insert("quarto-layout-cell")
           
      -- create css style for width
      local cell_div_style = ""
      local width = cell_div.attr.attributes["width"]
      local align = cell_div.attr.attributes[kLayoutAlign]
      cell_div.attr.attributes[kLayoutAlign] = nil
      cell_div_style = cell_div_style .. "flex-basis: " .. width .. ";"
      cell_div.attr.attributes["width"] = nil
      local justify = flexAlign(align)
      cell_div_style = cell_div_style .. "justify-content: " .. justify .. ";"

      local textAlign = textAlign(align)
      if textAlign then
        cell_div_style = cell_div_style .. "text-align: " .. textAlign .. ";"
      end
      cell_div.attr.attributes["style"] = cell_div_style
      
      local has_table = false
      local parent_id
      -- if it's a table then our table-inline style will cause table headers
      -- (th) to be centered. set them to left is they are default
      cell_div = _quarto.ast.walk(cell_div, {
        FloatRefTarget = function(float)
          parent_id = float.parent_id
          return nil
        end,
        Table = function(table)
          has_table = true
          local changed = false
          table.colspecs = table.colspecs:map(function(spec)
            if spec[1] == pandoc.AlignDefault then
              spec[1] = pandoc.AlignLeft
              changed = true
            end
            return spec
          end)
          if changed then 
            return table 
          end
        end
      }) or {} -- this isn't needed by the Lua analyzer doesn't know it

      if has_table and parent_id ~= nil then
        cell_div.attr.attributes[kRefParent] = parent_id
      end
      row_div.content[j] = cell_div
    end
    
    -- add row to the panel
    panel.content:insert(row_div)
  end

  local rendered_panel

  if panel_layout.is_float_reftarget then
    if #panel.content == 0 then
      warn("Panel layout for " .. (panel_layout.identifier or "(unnamed panel)") .. " has no content")
      return pandoc.Blocks({})
    end
    local float_node, float_tbl = quarto.FloatRefTarget({
      identifier = panel_layout.identifier,
      classes = panel_layout.classes,
      attributes = panel_layout.attributes,
      order = panel_layout.order,
      type = panel_layout.type,
      content = panel.content,
      caption_long = pandoc.List({panel_layout.caption_long}),
    })
    decorate_caption_with_crossref(float_tbl)
    rendered_panel = float_reftarget_render_html_figure(float_tbl)
    rendered_panel.attr = pandoc.Attr(panel_layout.identifier, {"quarto-layout-panel"})
  else
    rendered_panel = panel
    rendered_panel.attr = pandoc.Attr(
      panel_layout.identifier or "",
      panel_layout.classes,
      panel_layout.attributes)
    rendered_panel.attr.classes:insert("quarto-layout-panel")
  end
  local preamble = panel_layout.preamble
  if preamble == nil then
    return rendered_panel
  end
  
  local result = pandoc.Blocks({})
  panel_insert_preamble(result, preamble)
  result:insert(rendered_panel)
  return result
end)

function htmlDivFigure(el)
  
  return renderHtmlFigure(el, function(figure)
    
    -- get figure
    local figure = tslice(el.content, 1, #el.content-1)

    -- get caption
    local caption = refCaptionFromDiv(el)
    if caption then
      caption = caption.content
    else
      caption = nil
    end

    return figure, caption    
  end)
  
end


function htmlImageFigure(image)

  return renderHtmlFigure(image, function(figure)
    
    -- make a copy of the caption and clear it
    local caption = image.caption:clone()
    tclear(image.caption)
   
    -- pandoc sometimes ends up with a fig prefixed title
    -- (no idea way right now!)
    if image.title == "fig:" or image.title == "fig-" then
      image.title = ""
    end
   
    -- insert the figure without the caption
    local figure = { pandoc.Para({image}) }
    

    return figure, caption
    
  end)
  
end


function renderHtmlFigure(el, render)

  -- capture relevant figure attributes then strip them
  local align = figAlignAttribute(el)
  local keys = tkeys(el.attr.attributes)
  for _,k in pairs(keys) do
    if isFigAttribute(k) then
      el.attr.attributes[k] = nil
    end
  end
  local figureAttr = {}
  local style = el.attr.attributes["style"]
  if style then
    figureAttr["style"] = style
    el.attributes["style"] = nil
  end

  -- create figure div
  local figureDiv = pandoc.Div({}, pandoc.Attr(el.identifier, el.classes, figureAttr))

  -- remove identifier (it is now on the div)
  el.identifier = ""
  
  if not figureDiv.classes:find_if(function(str) return str:match("quarto%-figure%-.+") end) then
    -- apply standalone figure css if not already set
    figureDiv.attr.classes:insert("quarto-figure")
    figureDiv.attr.classes:insert("quarto-figure-" .. align)
  end

  -- also forward any column or caption classes
  local currentClasses = el.attr.classes
  for _,k in pairs(currentClasses) do
    if isCaptionClass(k) or isColumnClass(k) then
      figureDiv.attr.classes:insert(k)
    end
  end

  -- begin figure
  figureDiv.content:insert(pandoc.RawBlock("html", "<figure>"))
  
  -- render (and collect caption)
  local figure, captionInlines = render(figureDiv)
  
  -- render caption
  if captionInlines and #captionInlines > 0 then
    local figureCaption = pandoc.Plain({})
    figureCaption.content:insert(pandoc.RawInline(
      "html", "<figcaption>"
    ))
    tappend(figureCaption.content, captionInlines) 
    figureCaption.content:insert(pandoc.RawInline("html", "</figcaption>"))
    if cap_location_from_option('fig', 'bottom') == 'top' then
      figureDiv.content:insert(figureCaption)
      tappend(figureDiv.content, figure)
    else
      tappend(figureDiv.content, figure)
      figureDiv.content:insert(figureCaption)
    end
  else
    tappend(figureDiv.content, figure)
  end
  
  -- end figure and return
  figureDiv.content:insert(pandoc.RawBlock("html", "</figure>"))
  return figureDiv
  
end


function appendStyle(el, style)
  local baseStyle = attribute(el, "style", "")
  if baseStyle ~= "" and not string.find(baseStyle, ";$") then
    baseStyle = baseStyle .. ";"
  end
  el.attr.attributes["style"] = baseStyle .. style
end

function flexAlign(align)
  if align == "left" then
    return "flex-start"
  elseif align == "center" then
    return "center"
  elseif align == "right" then
    return "flex-end"
  end
end

function textAlign(align)
  return align
end

function vAlignClass(vAlign) 
  if vAlign == "top" then 
    return "quarto-layout-valign-top"
  elseif vAlign == "bottom" then
    return "quarto-layout-valign-bottom"
  elseif vAlign == "center" then
    return "quarto-layout-valign-center"
  end
end

