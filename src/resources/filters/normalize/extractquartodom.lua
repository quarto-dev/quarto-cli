local md_shortcode = require("lpegshortcode")

local function process_quarto_markdown_input_element(el)
  if el.attributes.qmd == nil and el.attributes["qmd-base64"] == nil then
    error("process_quarto_markdown_input_element called with element that does not have qmd or qmd-base64 attribute")
    return el
  end
  local text = el.attributes.qmd or quarto.base64.decode(el.attributes["qmd-base64"])
  local after_shortcodes = md_shortcode.md_shortcode:match(text)
  local after_reading = pandoc.read(after_shortcodes, "markdown")
  local after_parsing = after_reading:walk(parse_extended_nodes()):walk(compute_flags())
  return after_parsing
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
        if #doc.blocks < 1 then
          return pandoc.Span({})
        end
        return doc.blocks[1].content
      end
    end
  }
end