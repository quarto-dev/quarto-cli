-- brand.lua
-- Copyright (C) 2020-2024 Posit Software, PBC

local function get_color(name)
  local p = param("brand")
  if p == nil then
    return nil
  end
  local brand = p.processedData -- from src/core/brand/brand.ts
  if brand == nil then
    return nil
  end
  return brand.color[name]
end

return {
  get_color = get_color
}