-- figures.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- FIXME currently unused and will be sent to post-processing where
-- we will actually render all of this stuff.
local float_default_names = {
  fig = "Figure",
  tbl = "Table"
}

local function floatTitlePrefix(order, kind)
  local name = float_default_names[kind]
  local param_key = "crossref-" .. kind .. "-title"
  if name == nil then
    error("Unknown float kind: " .. kind)
  end
  return titlePrefix(kind, param(param_key, name), order)
end

-- process all figures
function crossref_figures()
  return {
    Div = function(el)
      if isFigureDiv(el) and isReferenceableFig(el) then
        fail("Should not have arrived here given new float crossref")
      end
    end,

    Para = function(el)
      local image = discoverFigure(el)
      if image and isFigureImage(image) then
        fail("Should not have arrived here given new float crossref")
      end
    end,

    -- process a float
    -- adding it to the global index of floats (figures, tables, etc)
    --
    -- in 1.4, we won't re-write its caption here, but instead we'll
    -- do it at the render filter.

    FloatCrossref = function(float)
      -- get label and base caption
      -- local label = el.attr.identifier
      local kind = refType(float.identifier)
    
      -- determine order, parent, and displayed caption
      local order
      local parent = float.parent_id
      if (parent) then
        order = nextSubrefOrder()
        -- prependSubrefNumber(captionContent, order)
      else
        order = indexNextOrder(kind)
        -- if _quarto.format.isLatexOutput() then
        --   tprepend(captionContent, {
        --     pandoc.RawInline('latex', '\\label{' .. label .. '}')
        --   })
        -- elseif _quarto.format.isAsciiDocOutput() or _quarto.format.isTypstOutput() then
        --   local _noop
        --   -- el.attr.identifier = label
        -- else
        --   tprepend(captionContent, floatTitlePrefix(order, kind))
        -- end
      end
    
      float.order = order
      -- update the index
      indexAddEntry(float.identifier, parent, order, {float.caption_long})
      return float
    end
  }
end

