function Pandoc(doc)
  if quarto.paths.rscript() == nil then
    crash()
  end
end