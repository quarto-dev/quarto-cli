function Pandoc(doc)
    doc.blocks:insert(pandoc.Para(pandoc.Str("Post 2")))
    return doc
end