function Pandoc(doc)
  local c = quarto.Callout({
    type = "note",
    content = { pandoc.Div(pandoc.Plain("This is a note")) },
    title = "Note title"
  })
  doc.blocks:insert(c)
  return doc
end