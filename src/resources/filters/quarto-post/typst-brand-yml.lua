function render_typst_brand_yml()
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

  local horz_to_typst = {
    left = "left",
    center = "center",
    right = "right",
  }
  local vert_to_typst = {
    top = "top",
    middle = "horizon",
    bottom = "bottom",
  }

  local function location_to_typst_align(location)
    local _, ndash = location:gsub('-', '')
    if ndash ~= 1 then return nil end
    local horz, vert = location:match '(%a+)--(%a+)'
    quarto.log.output('lota', horz, vert)
    if not horz_to_typst[horz] or not vert_to_typst[vert] then return nil end
    quarto.log.output('lota3', horz, vert)
    return horz_to_typst[horz] .. '+' .. vert_to_typst[vert]
  end

  return {
    Pandoc = function(pandoc)
      local brand = param('brand')
      if not brand then return nil end
      brand = brand.brand or brand

      -- logo
      if brand.logo then
        local logo = brand.logo
        if type(logo) ~= 'string' then
          if logo.large then
            logo = logo.large
          end
          -- and dark/light
        end
        if logo then
          local src = logo
          local padding = '0.5in'
          local width = '2in'
          local location = 'left+top'
          if type(logo) ~= 'string' then
            src = logo.src
            padding = logo.padding or padding
            width = logo.width or width
            location = logo.location and location_to_typst_align(logo.location) or location
            quarto.log.output('logggooo', location)
          end
          if src then
            quarto.doc.include_text('in-header',
              '#set page(background: align(' .. location .. ', box(inset: ' .. padding .. ', image("' .. src .. '", width: ' .. width .. '))))')
          end
        end
      end

      -- color
      if brand.color and brand.color.with then
        local palette = {}
        for name, color in pairs(brand.color.with) do
          palette[name] = output_typst_color(parse_css_color(color))
        end
        local decl = '#let brand-palette = ' .. to_typst_dict_indent(palette)
        quarto.doc.include_text('in-header', decl)
      end
      if brand.color then
        local BACKGROUND_OPACITY = 0.1
        local theme = {}
        local themebk = {}
        for name, color in pairs(brand.color) do
          if name ~= 'with' then
            if brand.color.with and brand.color.with[color] then
              theme[name] = 'brand-palette.' .. color
              color = brand.color.with[color] -- no nice idiomatic way to do bk color
            else
              theme[name] = output_typst_color(parse_css_color(color))
            end
            themebk[name] = output_typst_color(parse_css_color(color),
              {unit = 'fraction', value = BACKGROUND_OPACITY})
          end
        end
        local decl = '#let brand-theme = ' .. to_typst_dict_indent(theme)
        quarto.doc.include_text('in-header', decl)
        -- for demo purposes only, should implement backgroundcolor and fontcolor 
        if brand.color.background then
          quarto.doc.include_text('in-header', '#set page(fill: brand-theme.background)')
        end
        if brand.color.foreground then
          quarto.doc.include_text('in-header', '#set text(fill: brand-theme.foreground)')
        end
        local decl = '// theme colors at opacity ' .. BACKGROUND_OPACITY .. '\n#let brand-theme-background = ' .. to_typst_dict_indent(themebk)
        quarto.doc.include_text('in-header', decl)
      end

      -- typography
      if brand.typography then
        -- this is the only diagnostic Typst currently offers for font not found
        quarto.doc.include_text('in-header', '#set text(fallback: false)')
        local fontdir
        for target, font in pairs(brand.typography) do
          if target ~= 'font' then   -- handled in Meta
            local family = font.family
            if target == 'headings' then            
              quarto.doc.include_text('in-header', '#show heading: set text(font: "' .. family .. '")')
              -- quarto.doc.include_text('in-header', '#show article: set text(font: "' .. family .. '")')
            elseif target == 'monospace' then            
              quarto.doc.include_text('in-header', '#show raw: set text(font: "' .. family .. '")')
            end
          end
        end
      end
    end,
    Meta = function(meta)
      local brand = param('brand')
      if not brand then return nil end
      brand = brand.brand or brand

      if brand and brand.typography then
        if brand.typography.base then
          meta['mainfont'] = brand.typography.base.family 
        end
        if brand.typography.headings then
          meta['title-font'] = brand.typography.headings.family
        end
        if brand.typography.font then
          local kFontPaths = 'font-paths' -- no luck importing this
          for _, entry in ipairs(brand.typography.font) do
            if entry['files'] then fontdir = '.' end
          end
          if not fontdir then
            quarto.log.warning('hacky brand.yml only supports font: file: right now')
          else
            local fontPaths = meta[kFontPaths]
            if not fontPaths then
              meta[kFontPaths] = {fontdir}
              -- alas, lua cannot change ts metadata?
              -- at least, this is not seen at command/render/output-typst.ts
            end
            -- lots of other cases here to politely upgrade nil -> str -> array
          end
        end
        return meta
      end
    end
  }
end

