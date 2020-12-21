-- latex.lua
-- Copyright (C) 2020 by RStudio, PBC


function latexPanel(divEl, layout, caption)
  
  -- get alignment
  local align = layoutAlignAttribute(divEl)
  
   -- create container
  local panel = pandoc.Div({})
 
  -- begin container
  local env = nil
  local pos = nil
  if hasFigureRef(divEl) then
    env = attribute(divEl, kFigEnv, "figure")
    pos = attribute(divEll, kFigPos, nil)
  elseif hasTableRef(divEl) then
    env = "table"
  else
    env = "figure"
  end
  panel.content:insert(latexBeginEnv(env, pos));
  
  -- begin layout
  local layoutEl = pandoc.Para({})
  
  for i, row in ipairs(layout) do
    
    for i, cell in ipairs(row) do
      
      -- start cell on new line and indent content
      layoutEl.content:insert(pandoc.RawInline("latex", "\n  "))
      
      -- process cell (enclose content w/ alignment)
      local prefix, content, suffix = latexCell(cell)
      tappend(layoutEl.content, prefix)
      latexAppend(layoutEl.content, "\n")
      layoutEl.content:insert(pandoc.RawInline("latex", latexBeginAlign(align)))
      tappend(layoutEl.content, content)
      layoutEl.content:insert(pandoc.RawInline("latex", latexEndAlign(align)))
      latexAppend(layoutEl.content, "\n")
      tappend(layoutEl.content, suffix) 
     
      -- insert % unless this is the last cell in the row
      if i < #row then
        layoutEl.content:insert(pandoc.RawInline("latex", "%"))
      end
      
      -- newline after every cell
      layoutEl.content:insert(pandoc.RawInline("latex", "\n"))
    
    end
  
    -- insert separator unless this is the last row
    if i < #layout then
      layoutEl.content:insert(pandoc.RawInline("latex", "\\newline\n"))
    end
  
  end
  
  -- insert layout
  panel.content:insert(layoutEl)

  -- surround caption w/ appropriate latex (and end the figure)
  if caption then
    markupLatexCaption(caption.content)
    panel.content:insert(caption)
  end
  
  -- end latex env
  panel.content:insert(latexEndEnv(env));
  
  -- return panel
  return panel
  
end

function latexImageFigure(image)
  return renderLatexFigure(image, function(figure)
    
    -- make a copy of the caption and clear it
    local caption = image.caption:clone()
    tclear(image.caption)
    
    -- get align
    local align = figAlignAttribute(image)
   
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

function latexDivFigure(divEl)
  
  return renderLatexFigure(divEl, function(figure)
    
    -- append everything before the caption
    tappend(figure.content, tslice(divEl.content, 1, #divEl.content - 1))
    
    -- return any cpation we have
    local caption = refCaptionFromDiv(divEl)
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
  figure.content:insert(latexBeginEnv(figEnv, figPos))
  
  -- fill in the body (returns the caption inlines)
  local captionInlines = render(figure)  

  -- surround caption w/ appropriate latex (and end the figure)
  if captionInlines and inlinesToString(captionInlines) ~= "" then
    markupLatexCaption(el, captionInlines)
    figure.content:insert(pandoc.Para(captionInlines))
  end
  
  -- end figure
  figure.content:insert(latexEndEnv(figEnv))
  
  -- return the figure
  return figure
  
end


function isReferenceable(figEl)
  return figEl.attr.identifier ~= "" and 
         not isAnonymousFigId(figEl.attr.identifier)
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

function latexBeginEnv(env, pos)
  local beginEnv = "\\begin{" .. env .. "}"
  if pos then
    if not string.find(pos, "^%[{") then
      pos = "[" .. pos .. "]"
    end
    beginEnv = beginEnv .. pos
  end
  return pandoc.RawBlock("latex", beginEnv)
end

function latexEndEnv(env)
  return pandoc.RawBlock("latex", "\\end{" .. env .. "}")
end

function latexIsTikzImage(image)
  return string.find(image.src, "%.tex$")
end

function latexFigureInline(image)
  -- if this is a tex file (e.g. created w/ tikz) then use \\input
  if latexIsTikzImage(image) then
    
    -- be sure to inject \usepackage{tikz}
    layout.usingTikz = true
    
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



function latexCell(cell)

  -- figure out what we are dealing with
  local label = cell.attr.identifier
  local isFigure = isFigureRef(label)
  local isTable = isTableRef(label)
  local isSubRef = hasRefParent(cell)
  local image = figureImageFromLayoutCell(cell)
  local tbl = tableFromLayoutCell(cell)
  
  -- determine width (convert % to latex as necessary)
  local width = cell.attr.attributes["width"]
  local percentWidth = widthToPercent(width)
  if percentWidth then
    width = string.format("%2.2f", percentWidth/100) .. "\\linewidth"
  end
  
  -- derive prefix, content, and suffix
  local prefix = pandoc.List:new()
  local content = pandoc.List:new()
  local suffix = pandoc.List:new()

  -- sub-captioned always uses \subfloat
  if isSubRef then
    
    -- pull out the caption inlines if we can
    local caption = pandoc.List:new()
    if image then
      caption = image.caption:clone()
      tclear(image.caption)
    elseif tbl then
      caption = pandoc.utils.blocks_to_inlines(tbl.caption.long)
      tclear(tbl.caption.long)
      tclear(tbl.caption.short)
    else
      caption = refCaptionFromDiv(cell)
      cell.content = tslice(cell.content, 1, #cell.content-1)
    end
    
    -- prefix
    latexAppend(prefix, "\\subfloat[")
    tappend(prefix, caption)
    latexAppend(prefix, "]{\\label{" .. label .. "}%")
    
  end
  
  -- images are just plain \includegraphics 
  if image then
    image.attr.attributes["width"] = width
    if latexIsTikzImage(image) then
      content:insert(latexFigureInline(image))
    else
      tappend(content, pandoc.utils.blocks_to_inlines(cell.content))
    end
  -- otherwise use a minipage of the appropriate width
  else
    latexAppend(prefix, "\n\\begin{minipage}{" .. width .. "}\n")
    tappend(content, pandoc.utils.blocks_to_inlines(cell.content))
    latexAppend(suffix, "\n\\end{minipage}\n")
  end
  
  if isSubRef then
    latexAppend(suffix, "}")
  end
  
  return prefix, content, suffix
  
end

function latexAppend(inlines, latex)
  inlines:insert(pandoc.RawInline("latex", latex))
end

