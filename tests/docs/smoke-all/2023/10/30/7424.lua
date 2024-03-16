function Pandoc(doc)
    local f = io.open(quarto.doc.input_file, 'r')
    if f == nil then
        internal_error()
        return
    end
    f:close()
end