-- utils.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

function findChildDiv(el, matches) 
  local childDiv
  for i, v in ipairs(el.content) do
    if matches(v) then
      childDiv = v
    end
  end
  return childDiv
end

return {
  findChildDiv = findChildDiv
}