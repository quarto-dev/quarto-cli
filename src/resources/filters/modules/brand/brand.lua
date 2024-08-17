-- brand.lua
-- Copyright (C) 2020-2024 Posit Software, PBC

local function get_color(name)
  local brand = param("brand").processedData -- from src/core/brand/brand.ts
  local cssColor = brand.color[name]
  if not cssColor then return nil end
  if _quarto.format.isTypstOutput() then
    return output_typst_color(parse_css_color(cssColor))
  end
  return cssColor
end

local BACKGROUND_OPACITY = 0.1

local function get_background_color(name)
  local brand = param("brand").processedData -- from src/core/brand/brand.ts
  local cssColor = brand.color[name]
  if not cssColor then return nil end
  if _quarto.format.isTypstOutput() then
    return output_typst_color(parse_css_color(cssColor), {unit = 'fraction', value = BACKGROUND_OPACITY})
  end
  -- todo: implement for html if useful
  return cssColor
end

return {
  BACKGROUND_OPACITY = BACKGROUND_OPACITY,
  get_color = get_color,
  get_background_color = get_background_color,
}