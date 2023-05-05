-- figures.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- constants for figure attributes
kFigAlign = "fig-align"
kFigEnv = "fig-env"
kFigAlt = "fig-alt"
kFigPos = "fig-pos"
kFigCap = "fig-cap"
kFigScap = "fig-scap"
kResizeWidth = "resize.width"
kResizeHeight = "resize.height"


function isFigAttribute(name)
  return string.find(name, "^fig%-")
end

function figAlignAttribute(el)
  local default = pandoc.utils.stringify(
    param(kFigAlign, pandoc.Str("default"))
  )
  local align = attribute(el, kFigAlign, default)
  if align == "default" then
    align = default
  end
  return validatedAlign(align)
end

-- is this an image containing a figure
function isFigureImage(el)
  return hasFigureRef(el) and #el.caption > 0
end

-- is this a Div containing a figure
function isFigureDiv(el)
  if el.t == "Div" and hasFigureRef(el) then
    return refCaptionFromDiv(el) ~= nil
  else
    return discoverLinkedFigureDiv(el) ~= nil
  end
end

function discoverFigure(el, captionRequired)
  if el.t ~= "Para" then
    return nil
  end
  if captionRequired == nil then
    captionRequired = true
  end
  if #el.content == 1 and el.content[1].t == "Image" then
    local image = el.content[1]
    if not captionRequired or #image.caption > 0 then
      return image
    else
      return nil
    end
  else
    return nil
  end
end

function discoverLinkedFigure(el, captionRequired)
  if el.t ~= "Para" then
    return nil
  end
  if #el.content == 1 then 
    if el.content[1].t == "Link" then
      local link = el.content[1]
      if #link.content == 1 and link.content[1].t == "Image" then
        local image = link.content[1]
        if not captionRequired or #image.caption > 0 then
          return image
        end
      end
    end
  end
  return nil
end

function createFigureDiv(paraEl, fig)
  flags.has_figure_divs = true
  
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
      Image = function(image)
        return latexFigureInline(image, preState)
      end
    })
  end
  
  -- insert the paragraph and a caption paragraph
  figureDiv.content:insert(paraEl)
  figureDiv.content:insert(pandoc.Para(caption))
  
  -- return the div
  return figureDiv
  
end

function discoverLinkedFigureDiv(el, captionRequired)
  if el.t == "Div" and 
     hasFigureRef(el) and
     #el.content == 2 and 
     el.content[1].t == "Para" and 
     el.content[2].t == "Para" then
    return discoverLinkedFigure(el.content[1], captionRequired)  
  end
  return nil
end

local anonymousCount = 0
function anonymousFigId()
  anonymousCount = anonymousCount + 1
  return "fig-anonymous-" .. tostring(anonymousCount)
end

function isAnonymousFigId(identifier)
  return string.find(identifier, "^fig%-anonymous-")
end

function isReferenceableFig(figEl)
  return figEl.attr.identifier ~= "" and 
         not isAnonymousFigId(figEl.attr.identifier)
end



function latexIsTikzImage(image)
  return _quarto.format.isLatexOutput() and string.find(image.src, "%.tex$")
end

function latexFigureInline(image, state)
  -- if this is a tex file (e.g. created w/ tikz) then use \\input
  if latexIsTikzImage(image) then
    
    -- be sure to inject \usepackage{tikz}
    state.usingTikz = true
    
    -- base input
    local input = "\\input{" .. image.src .. "}"
    
    -- apply resize.width and/or resize.height if specified
    local rw = attribute(image, kResizeWidth, attribute(image, "width", "!"))
    local rh = attribute(image, kResizeHeight, attribute(image, "height", "!"))

    -- convert % to linewidth
    rw = asLatexSize(rw)
    rh = asLatexSize(rh)

    if rw ~= "!" or rh ~= "!" then
      input = "\\resizebox{" .. rw .. "}{" .. rh .. "}{" .. input .. "}"
    end
    
    -- return inline
    return pandoc.RawInline("latex", input)
  else
    return image
  end
end



