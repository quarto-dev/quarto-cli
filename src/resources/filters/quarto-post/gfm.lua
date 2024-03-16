-- gfm.lua
-- Copyright (C) 2023 Posit Software, PBC

function render_gfm_fixups()
  if not _quarto.format.isGithubMarkdownOutput() then 
    return {} 
  end
  return {
    Figure = function(fig)
      local link = quarto.utils.match("[1]/Plain/[1]/{Link}/[1]/Image")(fig)
      -- render these "figure" ourselves, because:
      --
      -- - GitHub markdown doesn't like the repeated captions we end up with
      -- - stripping the image alt text doesn't work as of 2023-12-14
      -- - Pandoc emits <figure> elements that are ugly and unnecessary
      --
      -- See #6118.

      if link then
        return pandoc.Para({link[1]})
      end
      local img = quarto.utils.match("[1]/Plain/[1]/Image")(fig)
      if img then
        return pandoc.Para({img})
      end
    end
  }
end