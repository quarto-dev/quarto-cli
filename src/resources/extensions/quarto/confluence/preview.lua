
-- filter to be run for local confluence preview

RawBlock = function(el)
  -- show code for raw 'confluence' blocks
  if el.format == "confluence" then
    return pandoc.CodeBlock(el.text, pandoc.Attr("", {"xml", "confluence-xml"}, 
      { filename = "Confluence XML", ["code-line-numbers"] = "false" }
    ))
  end
end