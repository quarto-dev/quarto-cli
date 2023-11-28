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

-- is this a Div containing a figure
function isFigureDiv(el, captionRequired)
  if is_regular_node(el, "Div") and hasFigureRef(el) then
    if captionRequired == nil then
      captionRequired = true
    end
    if not captionRequired then
      return true
    end
    return el.attributes[kFigCap] ~= nil or refCaptionFromDiv(el) ~= nil
  else
    return discoverLinkedFigureDiv(el) ~= nil
  end
end

local singleton_list = function(el) return #el.content == 1 end
function discoverFigure(el, captionRequired)
  if captionRequired == nil then
    captionRequired = true
  end
  local function check_caption(image)
    return #image.caption > 0 or not captionRequired
  end

  return quarto.utils.match(
    "Para", singleton_list, 1,
    "Image",
    check_caption)(el) or nil
end

function discoverLinkedFigure(el, captionRequired)
  local function check_caption(image)
    return #image.caption > 0 or not captionRequired
  end
  return quarto.utils.match(
    "Para", singleton_list, 1,
    "Link", singleton_list, 1,
    "Image", check_caption)(el) or nil
end

function discoverLinkedFigureDiv(el, captionRequired)
  if is_regular_node(el, "Div") and 
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

function latexFigureInline(image)
  -- if this is a tex file (e.g. created w/ tikz) then use \\input
  if latexIsTikzImage(image) then
    
    -- be sure to inject \usepackage{tikz}
    quarto_global_state.usingTikz = true
    
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



