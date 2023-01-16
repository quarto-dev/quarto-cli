function Pandoc(doc)
  if quarto.doc.is_filter_active("authors") then
    crash()
  end
end