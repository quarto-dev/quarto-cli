function render_typst_brand_yaml()
  if not _quarto.format.isTypstOutput() then
    return {}
  end

  local function sortedPairs(t, f)
    local a = {}
    for n in pairs(t) do table.insert(a, n) end
    table.sort(a, f)
    local i = 0      -- iterator variable
    local iter = function()   -- iterator function
        i = i + 1
        if a[i] == nil then return nil
        else return a[i], t[a[i]]
        end
    end
    return iter
  end

  local function to_typst_dict_indent(tab, curr, indent)
    curr = curr or ''
    indent = indent or '  '
    local entries = {}
    local inside = curr .. indent
    for k, v in sortedPairs(tab) do
      if type(v) == 'table' then
        v = to_typst_dict_indent(v, inside, indent)
      end
      if k and v then
        table.insert(entries, k .. ': ' .. v)
      end
    end
    if #entries == 0 then return nil end
    return '(\n' .. inside .. table.concat(entries, ',\n' .. inside) .. '\n' .. curr .. ')'
  end

  return {
    Pandoc = function(pandoc)
      local brand = param('brand')

      -- color
      if brand and brand.processedData and brand.processedData.color and next(brand.processedData.color) then
        local brandColor = brand.processedData.color
        local colors = {}
        for name, color in pairs(brandColor) do
          colors[name] = output_typst_color(parse_css_color(color))
        end
        local decl = '#let brand-color = ' .. to_typst_dict_indent(colors)
        quarto.doc.include_text('in-header', decl)
        local BACKGROUND_OPACITY = 0.1
        local themebk = {}
        for name, color in pairs(brandColor) do
          themebk[name] = output_typst_color(parse_css_color(color),
            {unit = 'fraction', value = BACKGROUND_OPACITY})
        end
        -- for demo purposes only, should implement backgroundcolor and fontcolor
        if brandColor.background then
          quarto.doc.include_text('in-header', '#set page(fill: brand-color.background)')
        end
        if brandColor.foreground then
          quarto.doc.include_text('in-header', '#set text(fill: brand-color.foreground)')
        end
        local decl = '// theme colors at opacity ' .. BACKGROUND_OPACITY .. '\n#let brand-color-background = ' .. to_typst_dict_indent(themebk)
        quarto.doc.include_text('in-header', decl)
      end
    end,
  }
end

