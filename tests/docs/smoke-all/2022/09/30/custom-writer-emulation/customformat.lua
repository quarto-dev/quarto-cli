function Pandoc(doc, emit)
    emit("<doc>")
    emit(doc.blocks)
    emit("</doc>")
end

function Callout(node)
    return "<callout/>"
end