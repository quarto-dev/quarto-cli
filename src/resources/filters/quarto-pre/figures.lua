-- figures.lua
-- Copyright (C) 2020 by RStudio, PBC


function figures() 
  
  return {
   
    Div = function(el)
      
      -- propagate fig-cap on figure div to figure caption 
      if hasFigureRef(el) then
        local figCap = attribute(el, kFigCap, nil)
        if figCap ~= nil then
          local caption = pandoc.Para(markdownToInlines(figCap))
          el.content:insert(caption)
          el.attr.attributes[kFigCap] = nil
        end
      end
      return el
      
    end,
    
    -- create figure divs from linked figures
    Para = function(el)
      
      -- create figure div if there is a tikz image
      local fig = discoverFigure(el)
      if fig and latexIsTikzImage(fig) then
        return createFigureDiv(el, fig)
      end
      
      -- create figure divs from linked figures
      local linkedFig = discoverLinkedFigure(el)
      if linkedFig then
        return createFigureDiv(el, linkedFig)
      end
      
    end,

    -- propagate fig-alt
    Image = function(image)
      if isHtmlOutput() then
        -- read the fig-alt text and set the image alt
        local altText = attribute(image, kFigAlt, nil);
        if altText ~= nil then
          image.attr.attributes["alt"] = altText
          image.attr.attributes[kFigAlt] = nil
          return image
        end
      else 
        return image
      end
    end
  }
end


function createFigureDiv(paraEl, fig)
  
  -- create figure div
  local figureDiv = pandoc.Div({})
 
  -- transfer identifier
  figureDiv.attr.identifier = fig.attr.identifier
  fig.attr.identifier = ""
  
  -- provide anonymous identifier if necessary
  if figureDiv.attr.identifier == "" then
    figureDiv.attr.identifier = anonymousFigId()
  end
  
  -- transfer classes
  figureDiv.attr.classes = fig.attr.classes:clone()
  tclear(fig.attr.classes)
  
  -- transfer fig. attributes
  for k,v in pairs(fig.attr.attributes) do
    if isFigAttribute(k) then
      figureDiv.attr.attributes[k] = v
    end
  end
  local attribs = tkeys(fig.attr.attributes)
  for _,k in ipairs(attribs) do
    if isFigAttribute(k) then
      fig.attr.attributes[k] = v
    end
  end
    
  --  collect caption
  local caption = fig.caption:clone()
  fig.caption = {}
  
  -- if the image is a .tex file we need to tex \input 
  if latexIsTikzImage(fig) then
    paraEl = pandoc.walk_block(paraEl, {
      Image = latexFigureInline
    })
  end
  
  -- insert the paragraph and a caption paragraph
  figureDiv.content:insert(paraEl)
  figureDiv.content:insert(pandoc.Para(caption))
  
  -- return the div
  return figureDiv
  
end

function latexIsTikzImage(image)
  return isLatexOutput() and string.find(image.src, "%.tex$")
end

function latexFigureInline(image)
  -- if this is a tex file (e.g. created w/ tikz) then use \\input
  if latexIsTikzImage(image) then
    
    -- be sure to inject \usepackage{tikz}
    preState.usingTikz = true
    
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



