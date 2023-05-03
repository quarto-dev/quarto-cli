-- figures.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- process all figures
function crossref_figures()
  return {
    Div = function(el)
      if isFigureDiv(el) and isReferenceableFig(el) then
        local caption = refCaptionFromDiv(el)
        if caption then
          process_figure(el, caption.content)
        end
      end
      return el
    end,

    Para = function(el)
      local image = discoverFigure(el)
      if image and isFigureImage(image) then
        process_figure(image, image.caption)
      end
      return el
    end
  }
end


-- process a figure, re-writing its caption as necessary and
-- adding it to the global index of figures
function process_figure(el, captionContent)
  -- get label and base caption
  local label = el.attr.identifier
  local caption = captionContent:clone()

  -- determine order, parent, and displayed caption
  local order
  local parent = el.attr.attributes[kRefParent]
  if (parent) then
    order = nextSubrefOrder()
    prependSubrefNumber(captionContent, order)
  else
    order = indexNextOrder("fig")
    if _quarto.format.isLatexOutput() then
      tprepend(captionContent, {
        pandoc.RawInline('latex', '\\label{' .. label .. '}')
      })
    elseif _quarto.format.isAsciiDocOutput() or _quarto.format.isTypstOutput() then
      el.attr.identifier = label
    else
      tprepend(captionContent, figureTitlePrefix(order))
    end
  end

  -- update the index
  indexAddEntry(label, parent, order, caption)
end


function figureTitlePrefix(order)
  return titlePrefix("fig", param("crossref-fig-title", "Figure"), order)
end
