-- brand.lua
-- Copyright (C) 2020-2024 Posit Software, PBC

local function get_color(name)
  local brand = param("brand").processedData -- from src/core/brand/brand.ts
  return brand.color[name]
end

return {
  get_color = get_color
}