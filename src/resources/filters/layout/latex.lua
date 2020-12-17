-- latex.lua
-- Copyright (C) 2020 by RStudio, PBC


function latexPanel(divEl, subfigures)
  return latexDivFigure(divEl, subfigures)
end

function latexImageFigure(image)
  return renderLatexFigure(image, function(figure)
    
    -- make a copy of the caption and clear it
    local caption = image.caption:clone()
    tclear(image.caption)
    
    -- get align
    local align = alignAttribute(image)
   
    -- insert the figure without the caption
    local figurePara = pandoc.Para({
      pandoc.RawInline("latex", latexBeginAlign(align)),
      latexFigureInline(image),
      pandoc.RawInline("latex", latexEndAlign(align)),
      pandoc.RawInline("latex", "\n")
    })
    figure.content:insert(figurePara)
    
    -- return the caption inlines
    return caption
    
  end)
end

function latexDivFigure(divEl, subfigures)
  
  return renderLatexFigure(divEl, function(figure)
    
    -- subfigures
    if subfigures then
      local subfiguresEl = pandoc.Para({})
      for i, row in ipairs(subfigures) do
        
        for _, image in ipairs(row) do
          
          -- get alignment
          local align = alignAttribute(image)
   
          -- begin subfigure
          subfiguresEl.content:insert(pandoc.RawInline("latex", "\\begin{subfigure}[b]"))
           
          -- get width for subfigure box (default to even spacing in row if none)
          local width = image.attr.attributes["width"]
          if not width then
            width = string.format("%2.2f", (1/#row)*96) .. '%'
          end
          
          -- generate subfigure box width
          local subfigureWidth = width
          local percentWidth = widthToPercent(width)
          if percentWidth then
            subfigureWidth = string.format("%2.2f", percentWidth/100) .. "\\linewidth"
          end
          
          -- apply it
          subfiguresEl.content:insert(pandoc.RawInline("latex", 
            "{" .. subfigureWidth .. "}"
          ))
        
          -- clear the width on the image (look for linked figure to clear as well)
          image.attr.attributes["width"] = nil
          if image.t == "Div" then
            local linkedFig = linkedFigureFromPara(image.content[1], false, true)
            if linkedFig then
              linkedFig.attr.attributes["width"] = nil
            end
          end
          
          -- see if have a caption (different depending on whether it's an Image or Div)
          local caption = nil
          if image.t == "Image" then
            caption = image.caption:clone()
            tclear(image.caption)
          else 
            caption = figureDivCaption(image).content
          end
          
          -- build caption
          if inlinesToString(caption) ~= "" then
            markupLatexCaption(image, caption)
          end
          image.attr.identifier = ""
          
          -- insert content
          subfiguresEl.content:insert(pandoc.RawInline("latex", "\n  "))
          subfiguresEl.content:insert(pandoc.RawInline("latex", latexBeginAlign(align)))
          if image.t == "Div" then
            -- append the div, slicing off the caption block
            tappend(subfiguresEl.content, pandoc.utils.blocks_to_inlines(
              tslice(image.content, 1, #image.content-1),
              { pandoc.LineBreak() }
            ))
          else
            subfiguresEl.content:insert(latexFigureInline(image))
          end
          subfiguresEl.content:insert(pandoc.RawInline("latex", latexEndAlign(align)))
          subfiguresEl.content:insert(pandoc.RawInline("latex", "\n"))
          
          -- insert caption
          if #caption > 0 then
            subfiguresEl.content:insert(pandoc.RawInline("latex", "  "))
            tappend(subfiguresEl.content, caption)
            subfiguresEl.content:insert(pandoc.RawInline("latex", "\n"))
          end
          
          -- end subfigure
          subfiguresEl.content:insert(pandoc.RawInline("latex", "\\end{subfigure}\n"))
          
        end
        
        -- insert separator unless this is the last row
        if i < #subfigures then
          subfiguresEl.content:insert(pandoc.RawInline("latex", "\\newline\n"))
        end
        
      end
      figure.content:insert(subfiguresEl)
    --  no subfigures, just forward content
    else
      tappend(figure.content, tslice(divEl.content, 1, #divEl.content - 1))
    end
  
    -- surround caption w/ appropriate latex (and end the figure)
    local caption = figureDivCaption(divEl)
    if caption then
      return caption.content
    else
      return nil
    end
  end)
  
end

function renderLatexFigure(el, render)
  
  -- create container
  local figure = pandoc.Div({})
  
  -- begin the figure
  local figEnv = attribute(el, kFigEnv, "figure")
  local figPos = attribute(el, kFigPos, nil)
  
  local beginEnv = "\\begin{" .. figEnv .. "}"
  if figPos then
    if not string.find(figPos, "^%[{") then
      figPos = "[" .. figPos .. "]"
    end
    beginEnv = beginEnv .. figPos
  end
  figure.content:insert(pandoc.RawBlock("latex", beginEnv))
  
  -- fill in the body (returns the caption inlines)
  local captionInlines = render(figure)  

  -- surround caption w/ appropriate latex (and end the figure)
  if captionInlines and inlinesToString(captionInlines) ~= "" then
    markupLatexCaption(el, captionInlines)
    figure.content:insert(pandoc.Para(captionInlines))
  end
  
  -- end figure
  figure.content:insert(pandoc.RawBlock("latex", "\\end{" .. figEnv .. "}"))
  
  -- return the figure
  return figure
  
end


function isReferenceable(figEl)
  return figEl.attr.identifier ~= "" and 
         not string.find(figEl.attr.identifier, "^fig:anonymous-")
end

function markupLatexCaption(el, caption)
  
  -- caption prefix (includes \\caption macro + optional [subcap] + {)
  local captionPrefix = pandoc.List:new({
    pandoc.RawInline("latex", "\\caption")
  })
  local figScap = attribute(el, kFigScap, nil)
  if figScap then
    captionPrefix:insert(pandoc.RawInline("latex", "["))
    tappend(captionPrefix, markdownToInlines(figScap))
    captionPrefix:insert(pandoc.RawInline("latex", "]"))
  end
  captionPrefix:insert(pandoc.RawInline("latex", "{"))
  tprepend(caption, captionPrefix)
  
  -- end the caption
  caption:insert(pandoc.RawInline("latex", "}"))
  
  -- include a label if this is referenceable
  if isReferenceable(el) then
    caption:insert(pandoc.RawInline("latex", "\\label{" .. el.attr.identifier .. "}"))
  end
end


function latexBeginAlign(align)
  if align == "center" then
    return "{\\centering "
  elseif align == "right" then
    return "\\hfill{} "      
  else
    return ""
  end
end

function latexEndAlign(align)
  if align == "center" then
    return "\n\n}"
  elseif align == "left" then
    return " \\hfill{}"
  else
    return ""
  end
end

function latexFigureInline(image)
  -- if this is a tex file (e.g. created w/ tikz) then use \\input
  if string.find(image.src, "%.tex$" ) then
    
    -- be sure to inject \usepackage{tikz}
    figures.usingTikz = true
    
    -- base input
    local input = "\\input{" .. image.src .. "}"
    
    -- apply resize.width and/or resize.height if specified
    local rw = attribute(image, kResizeWidth, "!")
    local rh = attribute(image, kResizeHeight, "!")
    if rw ~= "!" or rh ~= "!" then
      input = "\\resizebox{" .. rw .. "}{" .. rh .. "}{" .. input .. "}"
    end
    
    -- return inline
    return pandoc.RawInline("latex", input)
  else
    return image
  end
end


