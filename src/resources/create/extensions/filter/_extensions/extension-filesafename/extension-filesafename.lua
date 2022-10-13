
-- Reformat all heading text 
function Header(el)
  el.content = pandoc.Emph(el.content)
  return el
end
