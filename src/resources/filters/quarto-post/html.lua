-- html.lua
-- Copyright (C) 2023 Posit Software, PBC

function render_html_fixups()
  if not _quarto.format.isHtmlOutput() then 
    return {} 
  end

  return {
    Image = function(el)
      -- FIXME we're not validating here, but we can't use figAlignAttribute because
      -- it picks up the default value from the document metadata, which is not
      -- what we want here.
      local align = attribute(el, kFigAlign, nil)
      if align ~= nil then
        el.attributes[kFigAlign] = nil
        el.classes:insert("quarto-figure-" .. align)
      end
      local alt_text = attribute(el, kFigAlt, nil)
      if alt_text ~= nil then
        el.attributes["alt"] = alt_text
        el.attributes[kFigAlt] = nil
      end
    return el
    end
  }
end