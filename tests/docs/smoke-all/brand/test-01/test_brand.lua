local brand = require("modules/brand/brand")

function Pandoc(doc)
  assert(brand.get_color("primary") == "#FF0000")
  return doc
end