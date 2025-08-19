function Span(span)
    -- print(quarto.variables.get("var1"))
    -- print(quarto.metadata.get("meta1"))
    if span.identifier == "span1" then
        span.content = quarto.utils.string_to_inlines(
            pandoc.utils.stringify(quarto.variables.get("var1")))
        return span
    elseif span.identifier == "span2" then
        span.content = quarto.utils.string_to_inlines(
            pandoc.utils.stringify(quarto.metadata.get("meta1")))
        return span
    end
end

function Pandoc(doc)
    local function get_meta(key)
        return pandoc.utils.stringify(quarto.metadata.get(key))
    end
    assert(type(quarto.metadata.get("meta3")) == "table")
    assert(get_meta("meta2") == "2")
    assert(get_meta("meta4.key1") == "value1")
    assert(get_meta("meta4.key2") == "value2")
    assert(get_meta("meta_from_metadata") == "value_from_metadata")
end