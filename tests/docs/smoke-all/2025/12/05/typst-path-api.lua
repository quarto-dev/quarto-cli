function Pandoc(doc)
  if quarto.paths.typst() == nil then
    crash()
  end
end
