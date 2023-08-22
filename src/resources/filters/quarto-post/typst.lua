-- typst.lua
-- Copyright (C) 2021-2022 Posit Software, PBC

function render_typst()
  if _quarto.format.isTypstOutput() then
    return {
      Note = function(el)
        local inlines = pandoc.List{pandoc.RawInline("typst", "#footnote[")}
        inlines:extend(pandoc.utils.blocks_to_inlines(el.content))
        inlines:insert(pandoc.RawInline("typst", "]"))
        return inlines
      end
    }
  else
    return {}
  end
end