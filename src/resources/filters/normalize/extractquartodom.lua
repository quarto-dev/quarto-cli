local function process_quarto_markdown_input_element(el)
  if el.attributes.qmd == nil and el.attributes["qmd-base64"] == nil then
    error("process_quarto_markdown_input_element called with element that does not have qmd or qmd-base64 attribute")
    return el
  end
  local text = el.attributes.qmd or quarto.base64.decode(el.attributes["qmd-base64"])
  return string_to_quarto_ast_blocks(text)
end

function parse_md_in_html_rawblocks()
  return {
    Div = function(div)
      if div.attributes.qmd ~= nil or div.attributes["qmd-base64"] ~= nil then
        return process_quarto_markdown_input_element(div)
      end
    end,
    Span = function(span)
      if span.attributes.qmd ~= nil or span.attributes["qmd-base64"] ~= nil then
        local blocks = process_quarto_markdown_input_element(span)
        if blocks < 1 then
          return pandoc.Span({})
        end
        return blocks[1].content
      end
    end
  }
end