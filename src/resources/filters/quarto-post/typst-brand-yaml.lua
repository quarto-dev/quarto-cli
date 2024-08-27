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

      if brand and brand.processedData then
        -- color
        if brand.processedData.color and next(brand.processedData.color) then
          local brandColor = brand.processedData.color
          local colors = {}
          for name, _ in pairs(brandColor) do
            colors[name] = _quarto.modules.brand.get_color(name)
          end
          local decl = '#let brand-color = ' .. to_typst_dict_indent(colors)
          quarto.doc.include_text('in-header', decl)
          local BACKGROUND_OPACITY = 0.1
          local themebk = {}
          for name, _ in pairs(brandColor) do
            themebk[name] = _quarto.modules.brand.get_background_color(name)
          end
          -- for demo purposes only, should implement backgroundcolor and fontcolor
          if brandColor.background then
            quarto.doc.include_text('in-header', '#set page(fill: brand-color.background)')
          end
          if brandColor.foreground then
            quarto.doc.include_text('in-header', '#set text(fill: brand-color.foreground)')
          end
          local decl = '// theme colors at opacity ' .. _quarto.modules.brand.BACKGROUND_OPACITY .. '\n#let brand-color-background = ' .. to_typst_dict_indent(themebk)
          quarto.doc.include_text('in-header', decl)
        end

        -- typography
        if brand.processedData.typography then
          local typography = brand.processedData.typography
          if typography.headings and typography.headings.family then
            quarto.doc.include_text('in-header', '#show heading: set text(font: "' .. typography.headings.family .. '")')
          elseif typography.monospace and typography.monospace.family then
            quarto.doc.include_text('in-header', '#show raw: set text(font: "' .. typography.monospace.family .. '")')
          end
        end
      end
    end,
    Meta = function(meta)
      local brand = param('brand')
      if not brand or not brand.processedData or not brand.processedData.typography then return nil end
      local typography = brand.processedData.typography
      if typography.base and typography.base.family then
        meta['mainfont'] = typography.base.family
      end
      if typography.headings and typography.headings.family then
        meta['title-font'] = typography.headings.family
      end
      -- really should be _brand.yml directory
      local projectDir = pandoc.path.directory(quarto.doc.input_file)
      local fontdirs = {}
      for _, sel in ipairs({'base', 'headings', 'monospace'}) do
        if typography[sel] and typography[sel].files then
          local files = typography[sel].files
          if type(files) == 'string' then files = {files} end
          for _, file in ipairs(files) do
            local dir = pandoc.path.directory(pandoc.path.normalize(pandoc.path.join({projectDir, file})))
            fontdirs[dir] = true
          end        
        end
      end
      for fontdir, _ in pairs(fontdirs) do
        quarto.doc.add_typst_font_path(fontdir)
      end
      return meta
    end
  }
end

