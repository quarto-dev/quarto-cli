function Pandoc(doc)
  local callout = quarto.Callout({ title = "Typeless", content = pandoc.Para("Body.") })
  table.insert(doc.blocks, callout)
  return doc
end
