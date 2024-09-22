-- brand.lua
-- Copyright (C) 2020-2024 Posit Software, PBC

local function get_color(name)
  local brand = param("brand")
  brand = brand and brand.processedData -- from src/core/brand/brand.ts
  if not brand then return nil end
  local cssColor = brand.color[name]
  if not cssColor then return nil end
  if _quarto.format.isTypstOutput() then
    return output_typst_color(parse_css_color(cssColor))
  end
  return cssColor
end

local function get_background_color(name, opacity)
  local brand = param("brand")
  brand = brand and brand.processedData -- from src/core/brand/brand.ts
  if not brand then return nil end
  local cssColor = brand.color[name]
  if not cssColor then return nil end
  if _quarto.format.isTypstOutput() then
    return output_typst_color(parse_css_color(cssColor), {unit = 'fraction', value = opacity})
  end
  -- todo: implement for html if useful
  return cssColor
end

local function get_typography(fontName)
  local brand = param("brand")
  brand = brand and brand.processedData -- from src/core/brand/brand.ts
  if not brand then return nil end
  local typography = brand.typography and brand.typography[fontName]
  if not typography then return nil end
  local typsted = {}
  for k, v in pairs(typography) do
    if k == 'color' or k == 'background-color' then
      typsted[k] = output_typst_color(parse_css_color(v))
    elseif k == 'size' then
      typsted[k] = translate_css_length(v)
    else
      typsted[k] = v
    end
  end
  return typsted 
end

local function get_logo(name)
  local brand = param("brand")
  brand = brand and brand.processedData -- from src/core/brand/brand.ts
  if not brand then return nil end
  -- todo convert logo options from CSS to Typst
  return brand.logo and brand.logo[name]
end

return {
  get_color = get_color,
  get_background_color = get_background_color,
  get_typography = get_typography,
  get_logo = get_logo,
}