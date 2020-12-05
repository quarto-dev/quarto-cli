-- html.lua
-- Copyright (C) 2020 by RStudio, PBC

-- todo: consider native docx tables for office output
-- todo: headers for all lua files
-- todo: fig-link for html and table (watch for caption invalidation)
-- todo: may need to inject the css via header-includes 
--       (so it can be overriddeen by users)

function htmlPanel(divEl, subfigures)
  
  -- set global flag indicating we need html
  -- outer panel to contain css and figure panel (todo: move css)
  local panel = pandoc.Div({
    pandoc.RawBlock("html", [[
      <style type="text/css">
        .quarto-figure-panel figcaption {
          text-align: center;
        }
        .quarto-subfigure-row {
          display: flex;
          align-items: flex-end;
        }
        .quarto-subfigure {
          position: relative;
        }
        .quarto-subfigure figure {
          margin: 0.2em;
        }
        .quarto-subfigure figcaption {
          font-size: 0.8em;
          font-style: italic;
        }
        .quarto-subfigure figure > p:last-child:empty {
          display: none;
        }
      </style>
    ]])
  }, pandoc.Attr("", { "quarto-figure-panel" }))

  -- enclose in figure
  panel.content:insert(pandoc.RawBlock("html", "<figure>"))
  
  -- alignment
  local align = flexAlign(attribute(divEl, "fig-align", "default"))
  
  -- subfigures
  local subfiguresEl = pandoc.Para({})
  for i, row in ipairs(subfigures) do
    
    local figuresRow = pandoc.Div({}, pandoc.Attr("", {"quarto-subfigure-row"}))
    if align then
      figuresRow.attr.attributes["style"] = "justify-content: " .. align .. ";"
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
  caption.content:insert(pandoc.RawInline("html", "<figcaption>"))
  tappend(caption.content, divEl.content[#divEl.content].content)
  caption.content:insert(pandoc.RawInline("html", "</figcaption>"))
  panel.content:insert(caption)
  panel.content:insert(pandoc.RawBlock("html", "</figure>"))
  
  -- return panel
  return panel
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


