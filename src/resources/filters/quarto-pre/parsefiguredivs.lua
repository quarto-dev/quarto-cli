-- parsefiguredivs.lua
-- Copyright (C) 2023 Posit Software, PBC

function parse_figure_divs_into_floats()

  local function parse_figure_div(div)
    local key_prefix = refType(div.identifier)
    if key_prefix == nil then
      fail("Figure div without crossref identifier?")
      return
    end
    local category = crossref.categories.by_prefix[key_prefix]
    if category == nil then
      fail("Figure with invalid crossref category? " .. div.identifier)
      return
    end

    local caption = refCaptionFromDiv(div)
    if caption ~= nil then
      div.content:remove(#div.content)
    end
    local identifier = div.identifier
    div.identifier = ""
    return quarto.FloatCrossref({
      identifier = identifier,
      classes = div.classes,
      attributes = div.attributes,
      type = category.name,
      content = div.content,
      caption_long = {caption},
    })
  end

  return {
    Div = function(div)
      if isFigureDiv(div) then
        return parse_figure_div(div)
      end
    end,
    Para = function(para)
      if discoverLinkedFigure(para) ~= nil then
        local link = para.content[1]
        local img = link.content[1]
        local identifier = img.identifier
        if img.identifier == "" then
          return nil
        end
        img.identifier = ""
        local combined = pandoc.Attr("", {}, link.attributes) 
        for k, v in pairs(img.attributes) do
          combined.attributes[k] = v
        end
        -- print(combined.attributes)
        -- fail("STOP")
        -- return
        return quarto.FloatCrossref({
          identifier = identifier,
          classes = link.classes:extend(img.classes),
          attributes = combined.attributes,
          type = "figure",
          content = {link},
          caption_long = img.caption,
        })
      end
    end,
  }
end
