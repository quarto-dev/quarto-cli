function Pandoc(doc)
  local identifier = quarto.format.format_identifier()
  assert(identifier["target-format"] == "html+test")
  assert(identifier["base-format"] == "html")
  assert(identifier["display-name"] == "HTML")
  return doc
end