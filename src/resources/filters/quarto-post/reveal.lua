-- reveal.lua
-- Copyright (C) 2021-2022 Posit Software, PBC

local kShowNotes = require("../modules/constants").kShowNotes

function reveal()
  if _quarto.format.isRevealJsOutput() then
    return combineFilters{
      {
        Meta = function(meta)           
          if meta[kShowNotes] ~= nil and pandoc.utils.type(meta[kShowNotes]) == "Inlines" then
            meta[kShowNotes]:insert(1, '"')
            meta[kShowNotes]:insert('"')
            return meta
          end
        end,
        Div = applyPosition,
        Span = applyPosition,
        Image = applyPosition
      },
      {
        Div = fencedDivFix
      }
    }
  else
    return {}
  end
end

function applyPosition(el)
  if el.attr.classes:includes("absolute") then
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

function fencedDivFix(el)
  -- to solve https://github.com/quarto-dev/quarto-cli/issues/976
  -- until Pandoc may deal with it https://github.com/jgm/pandoc/issues/8098
  if el.content[1] and el.content[1].t == "Header" and el.attr.classes:includes("fragment") then
    level = PANDOC_WRITER_OPTIONS.slide_level
    if level and el.content[1].level > level then
      -- This will prevent Pandoc to create a <section>
      el.content:insert(1, pandoc.RawBlock("html", "<!-- -->"))
    end
  end
  return el
end