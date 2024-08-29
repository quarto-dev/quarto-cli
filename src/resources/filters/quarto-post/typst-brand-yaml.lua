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
            themebk[name] = _quarto.modules.brand.get_background_color(name, BACKGROUND_OPACITY)
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

        -- typography
        local headings = _quarto.modules.brand.get_typography('headings')
        if headings and headings.family then
          quarto.doc.include_text('in-header', '#show heading: set text(font: "' .. headings.family .. '")')
        end
        local monospace = _quarto.modules.brand.get_typography('monospace')
        if monospace and monospace.family then
            quarto.doc.include_text('in-header', '#show raw: set text(font: "' .. monospace.family .. '")')
        end

        -- logo
        local logo = param('logo')
        local logoOptions = {}
        local foundSrc = null
         if logo then
          if type(logo) == 'string' then
            foundSrc = _quarto.modules.brand.get_logo(logo) or logo
          elseif type(logo) == 'table' then
            for k, v in pairs(logo) do
              logoOptions[k] = v
            end
            if logo.src then
              foundSrc =  _quarto.modules.brand.get_logo(logo.src) or logo.src
            end
          end
        end
        if not foundSrc and brand.processedData.logo then
          local tries = {'large', 'small', 'medium'} -- low to high priority
          for _, try in ipairs(tries) do
            local src = _quarto.modules.brand.get_logo(try)
            if src then
              foundSrc = src
            end
          end
        end
        if foundSrc then
          if type(foundSrc) == "string" then
            logoOptions.src = foundSrc
          elseif foundSrc.light then
            logoOptions.src = foundSrc.light
          elseif foundSrc.dark then
            logoOptions.src = foundSrc.dark
          end
          -- todo: resolve logoOptions.src path
          logoOptions.padding = logoOptions.padding or '0.5in'
          logoOptions.width = logoOptions.width or '2in'
          logoOptions.location = logoOptions.location and
            location_to_typst_align(logoOptions.location) or 'left+top'
          quarto.log.debug('logo options', logoOptions)
          quarto.doc.include_text('in-header',
            '#set page(background: align(' .. logoOptions.location .. ', box(inset: ' .. logoOptions.padding .. ', image("' .. logoOptions.src .. '", width: ' .. logoOptions.width .. '))))')
        end  
      end
    end,
    Meta = function(meta)
      local base = _quarto.modules.brand.get_typography('base')
      if base and base.family then
        meta['mainfont'] = base.family
      end
      local headings = _quarto.modules.brand.get_typography('headings')
      if headings and headings.family then
        meta['title-font'] = headings.family
      end
      -- really should be _brand.yml directory
      local projectDir = pandoc.path.directory(quarto.doc.input_file)
      local fontdirs = {}
      for _, fontName in ipairs({'base', 'headings', 'monospace'}) do
        local font = _quarto.modules.brand.get_typography(fontName)
        if font and font.files then
          local files = font.files
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

