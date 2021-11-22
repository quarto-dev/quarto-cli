-- reveal.lua
-- Copyright (C) 2021 by RStudio, PBC

function reveal()
  if isRevealJsOutput() then
    return {
      Div = applyPosition,
      Span = applyPosition,
      Image = applyPosition
    }
  else
    return {}
  end
end

function applyPosition(el)
  if el.attr.classes:includes("r-absolute") then
    -- translate position attributes into style
    local style = el.attr.attributes['style']
    if style == nil then
      style = ''
    end
    local attrs = pandoc.List({ "top", "left", "bottom", "right", "width", "height" })
    for _, attr in ipairs(attrs) do
      local value = el.attr.attributes[attr]
      if value ~= nil then
        style = style .. attr .. ': ' .. asCssSize(value) .. '; '
        el.attr.attributes[attr] = nil
      end
    end
    el.attr.attributes['style'] = style
    return el
  end
end

function asCssSize(size)
  local number = tonumber(size)
  if number ~= nil then
    return tostring(number) .. "px"
  else
    return size
  end
end