-- html.lua
-- Copyright (C) 2020 by RStudio, PBC


-- todo: caption-less subfigures

-- todo: consider native docx tables for office output

function htmlPanel(divEl, subfigures)
  
  -- set flag indicating we need panel css
  figures.htmlPanels = true
  
  -- outer panel to contain css and figure panel
  local panel = pandoc.Div({}, pandoc.Attr("", { "quarto-figure-panel" }))

  -- enclose in figure
  panel.content:insert(pandoc.RawBlock("html", "<figure>"))
  
  -- collect alignment
  local align = attribute(divEl, "fig-align", nil)
  divEl.attr.attributes["fig-align"] = nil

  -- subfigures
  local subfiguresEl = pandoc.Para({})
  for i, row in ipairs(subfigures) do
    
    local figuresRow = pandoc.Div({}, pandoc.Attr("", {"quarto-subfigure-row"}))
    if align then
      appendStyle(figuresRow, "justify-content: " .. flexAlign(align) .. ";")
    end
    
    for i, image in ipairs(row) do
      
      -- create div to contain figure
      local figureDiv = pandoc.Div({}, pandoc.Attr("", {"quarto-subfigure"}))
      
      -- transfer any width and height to the container
      local figureDivStyle = ""
      local width = image.attr.attributes["width"]
      if width then
        figureDivStyle = figureDivStyle .. "width: " .. width .. ";"
        image.attr.attributes["width"] = nil
      end
      local height = image.attr.attributes["height"]
      if height then
        figureDivStyle = figureDivStyle .. "height: " .. height .. ";"
        image.attr.attributes["height"] = nil
      end
      if string.len(figureDivStyle) > 0 then
        figureDiv.attr.attributes["style"] = figureDivStyle
      end
      
      -- add figure to div
      if image.t == "Image" then
        figureDiv.content:insert(pandoc.Para(image))
      else
        figureDiv.content:insert(image)
      end
      
      -- add div to row
      figuresRow.content:insert(figureDiv)
    end
    
    -- add row to the panel
    panel.content:insert(figuresRow)
  end
  
  -- insert caption and </figure>
  local caption = pandoc.Para({})
  
  -- apply alignment if we have it
  local figcaption = "<figcaption aria-hidden=\"true\""
  if align then
    figcaption = figcaption .. " style=\"text-align: " .. align .. ";\""
  end
  figcaption = figcaption .. ">"
  
  caption.content:insert(pandoc.RawInline("html", figcaption))
  tappend(caption.content, divEl.content[#divEl.content].content)
  caption.content:insert(pandoc.RawInline("html", "</figcaption>"))
  panel.content:insert(caption)
  panel.content:insert(pandoc.RawBlock("html", "</figure>"))
  
  -- return panel
  return panel
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
  else
    return nil
  end
end


