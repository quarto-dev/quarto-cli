local found = false
function Header(el)
  found = found or el.level == 1
  return nil
end

function Pandoc(doc)
  if found then
    doc.blocks = pandoc.Blocks({
      pandoc.Str("true")
    })
  else
    doc.blocks = pandoc.Blocks({
      pandoc.Str("false")
    })
  end
  return doc
end