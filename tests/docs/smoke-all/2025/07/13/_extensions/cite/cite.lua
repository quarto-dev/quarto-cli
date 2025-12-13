function Cite(cite)
  return pandoc.Link(cite.content, "https://github.com/" .. cite.content[1].text:sub(2))
end
