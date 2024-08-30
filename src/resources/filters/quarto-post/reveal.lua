-- reveal.lua
-- Copyright (C) 2021-2022 Posit Software, PBC

local kShowNotes = require("modules/constants").kShowNotes

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

function render_reveal_fixups()
  if not _quarto.format.isRevealJsOutput() then
    return {}
  end
  return {
    -- Prevent BulletList in blockquote to be made incremental with .fragment class
    -- https://github.com/quarto-dev/quarto-cli/issues/7715
    BlockQuote = function(b)
      if #b.content and b.content[1].t == "BulletList" then
        b.content = pandoc.Div(b.content, pandoc.Attr('', {'blockquote-list-scaffold'}))
        return b
      end
    end
  }
end