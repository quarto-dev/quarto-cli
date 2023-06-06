-- parsefiguredivs.lua
-- Copyright (C) 2023 Posit Software, PBC

function parse_floats()

  local function parse_float_div(div)
    local key_prefix = refType(div.identifier)
    if key_prefix == nil then
      fail("Float div without crossref identifier?")
      return
    end
    local category = crossref.categories.by_prefix[key_prefix]
    if category == nil then
      fail("Float with invalid crossref category? " .. div.identifier)
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
    -- if we see a table with a caption that includes a tbl- label, then
    -- we normalize that to a FloatCrossref
    Table = function(el)
      if el.caption.long == nil then
        return nil
      end
      local last = el.caption.long[#el.caption.long]
      if not last or #last.content == 0 then
        return nil
      end

      -- check for tbl label
      local label = nil
      local caption, attr = parseTableCaption(last.content)
      if startsWith(attr.identifier, "tbl-") then
        -- set the label and remove it from the caption
        label = attr.identifier
        attr.identifier = ""
        last.content = createTableCaption(caption, attr)            
      end
    
      if not label then
        return nil
      end

      local combined = merge_attrs(el.attr, attr)

      return quarto.FloatCrossref({
        identifier = label,
        classes = combined.classes,
        attributes = combined.attributes,
        type = "table",
        content = {el},
        caption_long = el.caption.long,
      })
    end,

    Div = function(div)
      if isFigureDiv(div) or isTableDiv(div) then
        return parse_float_div(div)
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
        local combined = merge_attrs(img.attr, link.attr)
        return quarto.FloatCrossref({
          identifier = identifier,
          classes = combined.classes,
          attributes = combined.attributes,
          type = "figure",
          content = {link},
          caption_long = img.caption,
        })
      end
    end,
  }
end
