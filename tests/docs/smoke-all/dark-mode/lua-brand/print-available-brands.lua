function Pandoc(doc)
  if not quarto.brand then return nil end
  if quarto.brand.has_mode('light') then
    doc.blocks:insert(1, pandoc.Div(quarto.utils.as_blocks("this document has a light brand")))
  end
  if quarto.brand.has_mode('dark') then
    quarto.log.output('has dark')
    doc.blocks:insert(1, pandoc.Div(quarto.utils.as_blocks("this document has a dark brand")))
  end
  return doc
end
