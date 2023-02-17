local kMermaidClz = 'mermaid'

-- Reformat all heading text 
function CodeBlock(el)
  -- add mermaid-js
  if el.attr.classes:includes(kMermaidClz) then
    return pandoc.RawBlock("html", "<pre class='mermaid'>\n" .. el.text .. "\n</pre>")
  end
end