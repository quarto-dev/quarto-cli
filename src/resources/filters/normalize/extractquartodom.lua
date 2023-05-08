local function process_quarto_markdown_input_element(el)
  if el.attributes.qmd ~= nil then
    return pandoc.read(el.attributes.qmd, "markdown")
  elseif el.attributes["qmd-base64"] ~= nil then
    return pandoc.read(quarto.base64.decode(el.attributes["qmd-base64"]), "markdown")
  else
    error("process_quarto_markdown_input_element called with element that does not have qmd or qmd-base64 attribute")
  end
end

function parse_md_in_html_rawblocks()
  return {
    Div = function(div)
      if div.attributes.qmd ~= nil or div.attributes["qmd-base64"] ~= nil then
        local doc = process_quarto_markdown_input_element(div)
        return doc.blocks
      end
    end,
    Span = function(span)
      if span.attributes.qmd ~= nil or span.attributes["qmd-base64"] ~= nil then
        local doc = process_quarto_markdown_input_element(span)
        return doc.blocks[1].content
      end
    end
  }
end