function Pandoc(doc)
  if quarto.doc.is_filter_active("crossref") then
    crash()
  end
end