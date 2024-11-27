local brand = require("modules/brand/brand")

function Pandoc(doc)
  assert(brand.get_color("primary") == "#ff0000")
  return doc
end