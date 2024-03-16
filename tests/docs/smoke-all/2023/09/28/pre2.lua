function Pandoc(doc)
    doc.blocks:insert(pandoc.Para(pandoc.Str("Pre 2")))
    return doc
end