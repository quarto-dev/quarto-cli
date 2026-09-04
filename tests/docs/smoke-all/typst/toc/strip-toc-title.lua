-- Removes the toc-title metadata that Quarto adds before Pandoc runs,
-- causing article() to use its `toc_title: none` default.
function Meta(meta)
  meta["toc-title"] = nil
  return meta
end
