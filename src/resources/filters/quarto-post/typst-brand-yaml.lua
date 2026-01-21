function render_typst_brand_yaml()
  if not _quarto.format.isTypstOutput() then
    return {}
  end

  local function to_typst_dict_indent(tab, curr, indent)
    curr = curr or ''
    indent = indent or '  '
    local entries = {}
    local inside = curr .. indent
    for k, v in _quarto.utils.table.sortedPairs(tab) do
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
    if not horz_to_typst[horz] or not vert_to_typst[vert] then return nil end
    return horz_to_typst[horz] .. '+' .. vert_to_typst[vert]
  end  

  -- an approximation found here
  -- https://github.com/typst/typst/issues/159
  local function line_height_to_leading(lineHeight)
    if not lineHeight then
      return nil
    elseif type(lineHeight) == 'number' then
      return (lineHeight - 0.75) .. 'em'
    else
      quarto.log.warning("don't know how to use line-height " .. lineHeight .. ", only numeric supported atm")
    end
  end

  local function quote_string(value)
    if type(value) ~= 'string' then return value end
    return '"' .. value .. '"'
  end

  return {
    Pandoc = function(pandoc0)
      local brand = param('brand')
      local brandMode = param('brand-mode') or 'light'
      brand = brand and brand[brandMode]
      if brand and brand.processedData then
        -- color
        if brand.processedData.color and next(brand.processedData.color) then
          local brandColor = brand.processedData.color
          local colors = {}
          for name, _ in pairs(brandColor) do
            colors[name] = _quarto.modules.brand.get_color(brandMode, name)
          end
          local decl = '#let brand-color = ' .. to_typst_dict_indent(colors)
          quarto.doc.include_text('in-header', decl)
          if brandColor.background then
            quarto.doc.include_text('in-header', '#set page(fill: brand-color.background)')
          end
          if brandColor.foreground then
            quarto.doc.include_text('in-header', '#set text(fill: brand-color.foreground)')
            quarto.doc.include_text('in-header', '#set table.hline(stroke: (paint: brand-color.foreground))')
            quarto.doc.include_text('in-header', '#set line(stroke: (paint: brand-color.foreground))')
    
          end
          local themebk = {}
          for name, _ in pairs(brandColor) do
            if brandColor.background then
              local brandPercent = 15
              if brandMode == 'dark' then
                brandPercent = 50
              end
              local bkPercent = 100 - brandPercent
              themebk[name] = 'color.mix((brand-color.' .. name .. ', ' .. brandPercent .. '%), (brand-color.background, ' .. bkPercent .. '%))'
            else
              themebk[name] = 'brand-color.' .. name .. '.lighten(85%)'
            end
          end
          local decl = '#let brand-color-background = ' .. to_typst_dict_indent(themebk)
          quarto.doc.include_text('in-header', decl)
        end
        if brand.processedData.logo and next(brand.processedData.logo) then
          local logo = brand.processedData.logo
          if logo.images then
            local declImage = {}
            for name, image in pairs(logo.images) do
              declImage[name] = {
                path = quote_string(image.path):gsub('\\', '\\\\'),
                alt = quote_string(image.alt),
              }
            end
            if next(declImage) then
              quarto.doc.include_text('in-header', '#let brand-logo-images = ' .. to_typst_dict_indent(declImage))
            end
          end
          local declLogo = {}
          for _, size in pairs({'small', 'medium', 'large'}) do
            if logo[size] then
              declLogo[size] = {
                path = quote_string(logo[size].path):gsub('\\', '\\\\'),
                alt = quote_string(logo[size].alt),
              }
            end
          end
          if next(declLogo) then
            quarto.doc.include_text('in-header', '#let brand-logo = ' .. to_typst_dict_indent(declLogo))
          end
        end
        local function conditional_entry(key, value, quote_strings)
          if quote_strings == null then quote_strings = true end
          if not value then return '' end
          if quote_strings then value = quote_string(value) end
          return key .. ': ' .. value .. ', '
        end
        -- typography
        local base = _quarto.modules.brand.get_typography(brandMode, 'base')
        if base and next(base) then
            quarto.doc.include_text('in-header', table.concat({
              '#set text(',
              -- '#show par: set text(', overrules #show heading!
              conditional_entry('weight', _quarto.modules.typst.css.translate_font_weight(base.weight)),
              ')'
            }))
        end
        if base and base['line-height'] then
          local lineHeight = base['line-height']
          local leading = line_height_to_leading(lineHeight)
          if leading then
            quarto.doc.include_text('in-header', table.concat({
              '#set par(leading: ', leading, ')'
            }))
          end
        end

        local headings = _quarto.modules.brand.get_typography(brandMode, 'headings')
        if headings and next(headings) then
            quarto.doc.include_text('in-header', table.concat({
              '#show heading: set text(',
              conditional_entry('font', headings.family and _quarto.modules.typst.css.translate_font_family_list(headings.family), false),
              conditional_entry('weight', _quarto.modules.typst.css.translate_font_weight(headings.weight)),
              conditional_entry('style', headings.style),
              conditional_entry('fill', headings.color, false),
              ')'
            }))
        end
        if headings and headings['line-height'] then
          local lineHeight = headings['line-height']
          local leading = line_height_to_leading(lineHeight)
          if leading then
            quarto.doc.include_text('in-header', table.concat({
              '#show heading: set par(leading: ', leading, ')'
            }))
          end
        end

        -- monospace font family is handled by codefont in typst-template.typ via typst-show.typ
        -- here we only handle properties that Pandoc doesn't support: weight, size, color
        local monospaceInline = _quarto.modules.brand.get_typography(brandMode, 'monospace-inline')
        if monospaceInline and next(monospaceInline) then
            quarto.doc.include_text('in-header', table.concat({
              '#show raw.where(block: false): set text(',
              conditional_entry('weight', _quarto.modules.typst.css.translate_font_weight(monospaceInline.weight)),
              conditional_entry('size', monospaceInline.size, false),
              conditional_entry('fill', monospaceInline.color, false),
              ')'
            }))
        end
        if monospaceInline and monospaceInline['background-color'] then
          quarto.doc.include_text('in-header', table.concat({
            '#show raw.where(block: false): content => highlight(fill: ',
            monospaceInline['background-color'],
            ', content)'
          }))
        end
    
        -- monospace font family is handled by codefont in typst-template.typ via typst-show.typ
        -- here we only handle properties that Pandoc doesn't support: weight, size, color
        local monospaceBlock = _quarto.modules.brand.get_typography(brandMode, 'monospace-block')
        if monospaceBlock and next(monospaceBlock) then
          quarto.doc.include_text('in-header', table.concat({
            '#show raw.where(block: true): set text(',
            conditional_entry('weight', _quarto.modules.typst.css.translate_font_weight(monospaceBlock.weight)),
            conditional_entry('size', monospaceBlock.size, false),
            conditional_entry('fill', monospaceBlock.color, false),
            ')'
          }))
        end
        if monospaceBlock and monospaceBlock['background-color'] then
          raw_block_shown = true
          quarto.doc.include_text('in-header', table.concat({
            '#show raw.where(block: true): set block(fill: ',
            monospaceBlock['background-color'],
            ')'
          }))
        end
        if monospaceBlock and monospaceBlock['line-height'] then
          local lineHeight = monospaceBlock['line-height']
          local leading = line_height_to_leading(lineHeight)
          if leading then
            quarto.doc.include_text('in-header', table.concat({
              '#show raw.where(block: true): set par(leading: ', leading, ')'
            }))
          end
        end

        local link = _quarto.modules.brand.get_typography(brandMode, 'link')
        local primaryColor = _quarto.modules.brand.get_color(brandMode, 'primary')
        if link and next(link) or primaryColor then
          link = link or {}
          quarto.doc.include_text('in-header', table.concat({
            '#show link: set text(',
            conditional_entry('weight', _quarto.modules.typst.css.translate_font_weight(link.weight)),
            conditional_entry('fill', link.color or primaryColor, false),
            ')'
          }))
        end
        if link and link.decoration == 'underline' then
          quarto.doc.include_text('in-header', '#show link: content => underline(content)')
        end
        if link and link['background-color'] then
          quarto.doc.include_text('in-header', table.concat({
            '#show link: content => highlight(fill: ',
            link['background-color'],
            ', content)'
          }))
        end
      end
    end,
    Meta = function(meta)
      local brand = param('brand')
      local brandMode = param('brand-mode') or 'light'
      brand = brand and brand[brandMode]
      -- it can contain the path but we want to store an object here
      if not meta.brand or pandoc.utils.type(meta.brand) == 'Inlines' then
        meta.brand = {}
      end
      -- logo
      local logo = param('logo')
      if logo and not next(logo) then
        meta.logo = nil
      end
      local logoOptions = {}
      local foundLogo = logo and logo[brandMode]
      if foundLogo then
        for k, v in pairs(foundLogo) do
          logoOptions[k] = v
        end
        local pads = {}
        for k, v in _quarto.utils.table.sortedPairs(logoOptions) do
          if k == 'padding' then
            local widths = {}
            _quarto.modules.typst.css.parse_multiple(v, 5, function(s, start)
              local width, newstart = _quarto.modules.typst.css.consume_width(s, start)
              table.insert(widths, width)
              return newstart
            end)
            local sides = _quarto.modules.typst.css.expand_side_shorthand(
              widths,
              'widths in padding list: ' .. v)
            pads.top = sides.top
            pads.right = sides.right
            pads.bottom = sides.bottom
            pads.left = sides.left
          elseif k:find '^padding-' then
            local _, ndash = k:gsub('-', '')
            if ndash == 1 then
              local side = k:match('^padding--(%a+)')
              local padding_sides = {'left', 'top', 'right', 'bottom'}
              if tcontains(padding_sides, side) then
                pads[side] = _quarto.modules.typst.css.translate_length(v)
              else
                quarto.log.warning('invalid padding key ' .. k)
              end
            else
              quarto.log.warning('invalid padding key ' .. k)
            end
          end
        end
        local inset = nil
        if next(pads) then
          if pads.top == pads.right and
            pads.right == pads.bottom and
            pads.bottom == pads.left
          then
            inset = pads.top
          elseif pads.top == pads.bottom and pads.left == pads.right then
            inset = _quarto.modules.typst.as_typst_dictionary({x = pads.left, y = pads.top})
          else
            inset = _quarto.modules.typst.as_typst_dictionary(pads)
          end
        else
          inset = '0.75in'
        end
        logoOptions.width = _quarto.modules.typst.css.translate_length(logoOptions.width or '1.5in')
        logoOptions.inset = pandoc.RawInline('typst', inset)
        logoOptions.location = logoOptions.location and
          location_to_typst_align(logoOptions.location) or 'left+top'
        quarto.log.debug('logo options', logoOptions)
        local imageFilename = logoOptions.path
        if _quarto.modules.mediabag.should_mediabag(imageFilename) then
          imageFilename = _quarto.modules.mediabag.resolved_url_cache[logoOptions.path] or _quarto.modules.mediabag.fetch_and_store_image(logoOptions.path)
          imageFilename = _quarto.modules.mediabag.write_mediabag_entry(imageFilename) or imageFilename
          imageFilename = imageFilename and imageFilename:gsub('\\_', '_')
        else
          -- backslashes need to be doubled for Windows
          -- Only apply project offset for brand logo paths (project-relative).
          -- Extension-resolved paths (containing _extensions or starting with ..)
          -- are already input-relative and should not have the offset applied.
          -- See #13745 for the same pattern applied to font-paths.
          if imageFilename[1] ~= "/" and _quarto.projectOffset() ~= "." then
            local is_extension_path = string.find(imageFilename, "_extensions") or
              string.sub(imageFilename, 1, 2) == ".."
            if not is_extension_path then
              local offset = _quarto.projectOffset()
              imageFilename = pandoc.path.join({offset, imageFilename})
            end
          end
          imageFilename = string.gsub(imageFilename, '\\', '\\\\')
        end
        logoOptions.path = pandoc.RawInline('typst', imageFilename)
        meta.logo = logoOptions
      end
      meta.brand.typography = meta.brand.typography or {}
      local base = _quarto.modules.brand.get_typography(brandMode, 'base')
      if base and next(base) then
        meta.brand.typography.base = {
          family = base.family and pandoc.RawInline('typst', _quarto.modules.typst.css.translate_font_family_list(base.family)),
          size = base.size,
        }
      end

      local headings = _quarto.modules.brand.get_typography(brandMode, 'headings')
      local foregroundColor = _quarto.modules.brand.get_color(brandMode, 'foreground')
      if headings and next(headings) or base and next(base) or foregroundColor then
        base = base or {}
        headings = headings or {}
        local color = headings.color or foregroundColor
        color = color and pandoc.RawInline('typst', color)
        local weight = _quarto.modules.typst.css.translate_font_weight(headings.weight or base.weight)
        weight = weight and pandoc.RawInline('typst', tostring(quote_string(weight)))
        local family = headings.family or base.family
        meta.brand.typography.headings = {
          family = family and pandoc.RawInline('typst', _quarto.modules.typst.css.translate_font_family_list(family)),
          weight = weight,
          style = headings.style or base.style,
          decoration = headings.decoration or base.decoration,
          color = color,
          ['background-color'] = headings['background-color'] or base['background-color'],
          ['line-height'] = line_height_to_leading(headings['line-height'] or base['line-height']),
        }
      end

      local monospace = _quarto.modules.brand.get_typography(brandMode, 'monospace')
      if monospace and monospace.family then
        meta.brand.typography.monospace = {
          family = pandoc.RawInline('typst', _quarto.modules.typst.css.translate_font_family_list(monospace.family)),
        }
      end
      return meta
    end,
  }
end

