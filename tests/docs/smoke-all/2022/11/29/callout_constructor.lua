function Pandoc(doc)
  doc.blocks:insert(quarto.Callout({
    type = "note",
    content = { pandoc.Div(pandoc.Plain("This is a note")) },
    caption = "Note title"
  }))
  return doc
end