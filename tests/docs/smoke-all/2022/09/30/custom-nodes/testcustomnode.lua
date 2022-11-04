local found_it = false

return {
  MyCustomNode = function(node)
    found_it = true
  end,
  Pandoc = function(doc)
    if not found_it then
      crash()
    end
  end
}