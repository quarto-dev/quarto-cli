-- Removes the toc-title metadata that Quarto fills in before Pandoc runs,
-- so the Typst template receives its own `toc_title: none` default.
function Meta(meta)
  meta["toc-title"] = nil
  return meta
end
