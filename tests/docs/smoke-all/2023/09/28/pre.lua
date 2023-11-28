function Pandoc(doc)
    doc.blocks:insert(pandoc.Para(pandoc.Str("Pre 1")))
    return doc
end