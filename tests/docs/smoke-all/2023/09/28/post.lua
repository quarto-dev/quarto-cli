function Pandoc(doc)
    doc.blocks:insert(pandoc.Para(pandoc.Str("Post 1")))
    return doc
end