
-- imports
function script_path()
  local str = debug.getinfo(2, "S").source:sub(2)
  return str:match("(.*/)")
end
dofile(script_path() .. "figure.lua")
dofile(script_path() .. "index.lua")
dofile(script_path() .. "utils.lua")

-- crossref document
function Pandoc(doc)


  local figures = processFigures(doc)

  return doc
end





