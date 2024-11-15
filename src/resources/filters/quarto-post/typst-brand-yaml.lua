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

  return {
    Pandoc = function(pandoc)
      local brand = param('brand')
      local raw_block_shown = false
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
          if brandColor.background then
            quarto.doc.include_text('in-header', '#set page(fill: brand-color.background)')
          end
          if brandColor.foreground then
            quarto.doc.include_text('in-header', '#set text(fill: brand-color.foreground)')
            quarto.doc.include_text('in-header', '#set table.hline(stroke: (paint: brand-color.foreground))')
            quarto.doc.include_text('in-header', '#set line(stroke: (paint: brand-color.foreground))')
    
          end
          local decl = '// theme colors at opacity ' .. BACKGROUND_OPACITY .. '\n#let brand-color-background = ' .. to_typst_dict_indent(themebk)
          quarto.doc.include_text('in-header', decl)
        end
        local function quote_string(value)
          if type(value) ~= 'string' then return value end
          return '"' .. value .. '"'
        end
        local function conditional_entry(key, value, quote_strings)
          if quote_strings == null then quote_strings = true end
          if not value then return '' end
          if quote_strings then value = quote_string(value) end
          return key .. ': ' .. value .. ', '
        end
        -- typography
        local base = _quarto.modules.brand.get_typography('base')
        if base and next(base) then
            quarto.doc.include_text('in-header', table.concat({
              '#set text(',
              -- '#show par: set text(', overrules #show heading!
              conditional_entry('weight', base.weight),
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

        local headings = _quarto.modules.brand.get_typography('headings')
        if headings and next(headings) then
            quarto.doc.include_text('in-header', table.concat({
              '#show heading: set text(',
              conditional_entry('font', headings.family),
              conditional_entry('weight', headings.weight),
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

        local monospaceInline = _quarto.modules.brand.get_typography('monospace-inline')
        if monospaceInline and next(monospaceInline) then
            quarto.doc.include_text('in-header', table.concat({
              '#show raw.where(block: false): set text(',
              conditional_entry('font', monospaceInline.family),
              conditional_entry('weight', monospaceInline.weight),
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
    
        local monospaceBlock = _quarto.modules.brand.get_typography('monospace-block')
        if monospaceBlock and next(monospaceBlock) then
          quarto.doc.include_text('in-header', table.concat({
            '#show raw.where(block: true): set text(',
            conditional_entry('font', monospaceBlock.family),
            conditional_entry('weight', monospaceBlock.weight),
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

        local link = _quarto.modules.brand.get_typography('link')
        local primaryColor = _quarto.modules.brand.get_color('primary')
        if link and next(link) or primaryColor then
          link = link or {}
          quarto.doc.include_text('in-header', table.concat({
            '#show link: set text(',
            conditional_entry('weight', link.weight),
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
  
        -- logo
        local logo = param('logo')
        local logoOptions = {}
        local foundLogo = null
         if logo then
          if type(logo) == 'string' then
            foundLogo = _quarto.modules.brand.get_logo(logo) or {light={path=logo}}
          elseif type(logo) == 'table' then
            for k, v in pairs(logo) do
              logoOptions[k] = v
            end
            if logo.path then
              foundLogo =  _quarto.modules.brand.get_logo(logo.path) or {light={path=logo}}
            end
          end
        end
        if not foundLogo and brand.processedData.logo then
          local tries = {'large', 'small', 'medium'} -- low to high priority
          foundLogo = _quarto.modules.brand.get_logo('medium')
            or _quarto.modules.brand.get_logo('small')
            or _quarto.modules.brand.get_logo('large')
        end
        if foundLogo then
          if foundLogo.light then
            logoOptions.path = foundLogo.light.path
            logoOptions.alt = foundLogo.light.alt
          elseif foundLogo.dark then
            logoOptions.path = foundLogo.dark.path
            logoOptions.alt = foundLogo.dark.alt
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
            inset = '0.5in'
          end
          logoOptions.width = _quarto.modules.typst.css.translate_length(logoOptions.width or '2in')
          logoOptions.location = logoOptions.location and
            location_to_typst_align(logoOptions.location) or 'left+top'
          quarto.log.debug('logo options', logoOptions)
          local altProp = logoOptions.alt and (', alt: "' .. logoOptions.alt .. '"') or ''
          local dblbackslash = string.gsub(logoOptions.path, '\\', '\\\\') -- double backslash?
          quarto.doc.include_text('in-header',
            '#set page(background: align(' .. logoOptions.location .. ', box(inset: ' .. inset .. ', image("' .. dblbackslash .. '", width: ' .. logoOptions.width .. altProp .. '))))')
        end  
      end
    end,
    Meta = function(meta)
      -- it can contain the path but we want to store an object here
      if not meta.brand or pandoc.utils.type(meta.brand) == 'Inlines' then
        meta.brand = {}
      end
      meta.brand.typography = meta.brand.typography or {}
      local base = _quarto.modules.brand.get_typography('base')
      if base and next(base) then
        meta.brand.typography.base = {
          family = base.family,
          size = base.size,
        }
      end

      local headings = _quarto.modules.brand.get_typography('headings')
      local foregroundColor = _quarto.modules.brand.get_color('foreground')
      if headings and next(headings) or base and next(base) or foregroundColor then
        base = base or {}
        headings = headings or {}
        local color = headings.color or foregroundColor
        color = color and pandoc.RawInline('typst', color)
        meta.brand.typography.headings = {
          family = headings.family or base.family,
          weight = headings.weight or base.weight,
          style = headings.style or base.style,
          decoration = headings.decoration or base.decoration,
          color = color,
          ['background-color'] = headings['background-color'] or base['background-color'],
          ['line-height'] = line_height_to_leading(headings['line-height'] or base['line-height']),
        }
      end
      return meta
    end,
  }
end

