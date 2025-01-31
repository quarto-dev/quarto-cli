-- brand.lua
-- Copyright (C) 2020-2024 Posit Software, PBC

local function get_color_css(name)
  local brand = param("brand")
  brand = brand and brand.processedData -- from src/core/brand/brand.ts
  if not brand then return nil end
  local cssColor = brand.color[name]
  return cssColor
end

local function get_color(name)
  local cssColor = get_color_css(name)
  if not cssColor then return nil end
  if _quarto.format.isTypstOutput() then
    return _quarto.format.typst.css.output_color(_quarto.format.typst.css.parse_color(cssColor))
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
    return _quarto.format.typst.css.output_color(_quarto.modules.typst.css.parse_color(cssColor), {unit = 'fraction', value = opacity})
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
  if type(typography) == 'string' then typography = {family = typography} end
  for k, v in pairs(typography) do
    if k == 'color' or k == 'background-color' then
      typsted[k] = get_color(v) or _quarto.format.typst.css.output_color(_quarto.format.typst.css.parse_color(v))
    elseif k == 'size' then
      local length = _quarto.format.typst.css.parse_length(v)
      if length and fontName == 'base' and length.unit == 'rem' then
        -- this should not be a problem? because it's being set in the header?
        quarto.log.warning('brand.typography.base.size in rem units, changing to em')
        typsted[k] = length.value .. 'em'
      else
        typsted[k] = _quarto.format.typst.css.translate_length(v)
      end
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
  return brand.logo and (brand.logo[name] or brand.logo.images[name])
end

return {
  get_color_css = get_color_css,
  get_color = get_color,
  get_background_color = get_background_color,
  get_typography = get_typography,
  get_logo = get_logo,
}