-- html.lua
-- Copyright (C) 2020 by RStudio, PBC

function htmlPanel(divEl, subfigures)
  
  -- set flag indicating we need figure css
  figures.htmlFigures = true
  
  -- outer panel to contain css and figure panel
  local panel = pandoc.Div({}, pandoc.Attr("", { "quarto-figure-panel" }))

  -- enclose in figure
  panel.content:insert(pandoc.RawBlock("html", "<figure>"))
  
  -- collect alignment
  local align = alignAttribute(divEl)
  divEl.attr.attributes[kFigAlign] = nil

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
      if align then
        figureDivStyle = figureDivStyle .. "text-align: " .. align .. ";"
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
  local divCaption = figureDivCaption(divEl)
  if divCaption and #divCaption.content > 0 then
    local caption = pandoc.Para({})
    -- apply alignment if we have it
    local figcaption = "<figcaption aria-hidden=\"true\""
    if align then
      figcaption = figcaption .. " style=\"text-align: " .. align .. ";\""
    end
    figcaption = figcaption .. ">"
    
    caption.content:insert(pandoc.RawInline("html", figcaption))
    tappend(caption.content, divCaption.content)
    caption.content:insert(pandoc.RawInline("html", "</figcaption>"))
    panel.content:insert(caption)
  end
  
  panel.content:insert(pandoc.RawBlock("html", "</figure>"))
  
  -- return panel
  return panel
end

function htmlDivFigure(el)
  
  return renderHtmlFigure(el, function(figure)
    -- render content
    tappend(figure.content, tslice(el.content, 1, #el.content-1))
    
    -- extract and return caption inlines
    local caption = figureDivCaption(el)
    if caption then
      return caption.content
    else
      return nil
    end
    
  end)
  
end


function htmlImageFigure(image)
  
  return renderHtmlFigure(image, function(figure)
    
    -- make a copy of the caption and clear it
    local caption = image.caption:clone()
    tclear(image.caption)
   
    -- pandoc sometimes ends up with a title of "fig:"
    if image.title == "fig:" then
      image.title = ""
    end
   
    -- insert the figure without the caption
    figure.content:insert(pandoc.Para({image, pandoc.RawInline("markdown", "<!-- -->")}))
    
    -- return the caption inlines
    return caption
    
  end)
  
end


function renderHtmlFigure(el, render)
  
   -- set flag indicating we need figure css
  figures.htmlFigures = true
  
  -- capture relevant figure attributes then strip them
  local align = alignAttribute(el)
  local keys = tkeys(el.attr.attributes)
  for _,k in pairs(keys) do
    if isFigAttribute(k) then
      el.attr.attributes[k] = nil
    end
  end
  
  -- create figure div
  local figureDiv = pandoc.Div({}, el.attr:clone())
  
  -- remove identifier and classes from target (they are now on the div)
  el.attr.identifier = ""
  tclear(el.attr.classes)
          
  -- apply standalone figure css if we are not a subfigure
  if not isSubfigure(figureDiv) then
    figureDiv.attr.classes:insert("quarto-figure")
    if align then
      appendStyle(figureDiv, "text-align: " .. align .. ";")
    end
  end
  
  -- begin figure
  figureDiv.content:insert(pandoc.RawBlock("html", "<figure>"))
  
  -- render (and collect caption)
  local captionInlines = render(figureDiv)
  
  -- render caption
  if captionInlines and #captionInlines > 0 then
    local figureCaption = pandoc.Para({})
    figureCaption.content:insert(pandoc.RawInline(
      "html", "<figcaption aria-hidden=\"true\">"
    ))
    tappend(figureCaption.content, captionInlines) 
    figureCaption.content:insert(pandoc.RawInline("html", "</figcaption>"))
    figureDiv.content:insert(figureCaption)
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
  else
    return nil
  end
end


