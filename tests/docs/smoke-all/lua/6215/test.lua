function Pandoc(doc)
  quarto.utils.dump(quarto.utils)
  doc.blocks:extend(quarto.utils.string_to_blocks("Some markdown.\n\n[{{< meta test_key >}}]{#test_span}"))
  return doc
end