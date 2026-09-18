function Pandoc(doc)
  assert(quarto.doc.pdf_engine() == "xelatex", "`quarto.doc.pdf_engine()` should be xelatex but is instead: " .. quarto.doc.pdf_engine())
  assert(quarto.doc.cite_method() == nil, "`quarto.doc.cite_method()` should return natbib but return instead: " .. (quarto.doc.cite_method() or 'unset'))
  return doc
end