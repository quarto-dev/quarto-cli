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
  -- the markdown writer emits notes collected from metadata after the body
  doc.meta = pandoc.Meta({})
  return doc
end