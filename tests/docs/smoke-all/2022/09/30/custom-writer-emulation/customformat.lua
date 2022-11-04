function Pandoc(doc, emit)
    emit("<doc>")
    emit(doc.blocks)
    emit("</doc>")
end

function MyCustomNode(node)
    return "<custom-node/>"
end