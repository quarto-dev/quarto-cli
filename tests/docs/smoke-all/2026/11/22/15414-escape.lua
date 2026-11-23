function Pandoc(doc)
  local callout = quarto.Callout({ type = 'say"hi\\there', title = "Quoted type", content = pandoc.Para("Body.") })
  table.insert(doc.blocks, callout)
  return doc
end
