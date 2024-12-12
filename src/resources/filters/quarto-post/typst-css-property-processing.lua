local constants = require("modules/constants")

function format_typst_float(x)
  local f = string.format('%.2f', x)
  -- trim zeros after decimal point
  return f:gsub('%.00', ''):gsub('%.(%d)0', '.%1')
end

function render_typst_css_property_processing()
  if not _quarto.format.isTypstOutput() or
    param(constants.kCssPropertyProcessing, 'translate') ~= 'translate' then
    return {}
  end

  local function to_kv(prop_clause)
    return string.match(prop_clause, '([%w-]+)%s*:%s*(.*)$')
  end

  local _warnings
  local function new_table()
    local ret = {}
    setmetatable(ret, {__index = table})
    return ret
  end
  local function aggregate_warnings()
    local counts = {}
    for _, warning in ipairs(_warnings) do
      counts[warning] = (counts[warning] or 0) + 1
    end
    for warning, count in pairs(counts) do
      quarto.log.warning('(' .. string.format('%4d', count) .. ' times) ' .. warning)
    end
  end

  local function dequote(s)
    return s:gsub('^["\']', ''):gsub('["\']$', '')
  end

  local function quote(s)
    return '"' .. s .. '"'
  end

  local function translate_vertical_align(va)
    if va == 'top' then
      return 'top'
    elseif va == 'middle' then
      return 'horizon'
    elseif va == 'bottom' then
      return 'bottom'
    end
  end

  -- does the table contain a value
  local function tcontains(t,value)
    if t and type(t)=='table' and value then
      for _, v in ipairs(t) do
        if v == value then
          return true
        end
      end
      return false
    end
    return false
  end

  local function translate_horizontal_align(ha)
    if tcontains({'start', 'end', 'center'}, ha) then
      return ha
    end
    return nil
  end

  local border_sides = {'left', 'top', 'right', 'bottom'}
  local border_properties = {'width', 'style', 'color'}
  local function all_equal(seq)
    local a = seq[1]
    for i = 2, #seq do
      if a ~= seq[i] then
        return false
      end
    end
    return true
  end


  local border_translators = {
    width = {
      prop = 'thickness',
      fn = _quarto.modules.typst.css.translate_border_width
    },
    style = {
      prop = 'dash',
      fn = _quarto.modules.typst.css.translate_border_style
    },
    color = {
      prop = 'paint',
      fn = _quarto.modules.typst.css.translate_border_color
    }
  }

  local border_consumers = {
    width = _quarto.modules.typst.css.consume_width,
    style = _quarto.modules.typst.css.consume_style,
    color = _quarto.modules.typst.css.consume_color,
  }
  local function handle_border(k, v, borders)
    local _, ndash = k:gsub('-', '')
    if ndash == 0 then
      local border = _quarto.modules.typst.css.translate_border(v, _warnings)
      for _, side in ipairs(border_sides) do
        borders[side] = borders[side] or {}
        for k2, v2 in pairs(border) do
          borders[side][k2] = v2
        end
      end
    elseif ndash == 1 then
      local part = k:match('^border--(%a+)')
      if tcontains(border_sides, part) then
        borders[part] = borders[part] or {}
        local border = _quarto.modules.typst.css.translate_border(v, _warnings)
        for k2, v2 in pairs(border) do
          borders[part][k2] = v2
        end
      elseif tcontains(border_properties, part) then
        local items = {}
        -- one extra only so we can error on it
        _quarto.modules.typst.css.parse_multiple(v, 5, function(s, start)
          local item, newstart = border_consumers[part](s, start)
          table.insert(items, item)
          return newstart
        end)
        for _, side in ipairs(border_sides) do
          borders[side] = borders[side] or {}
        end
        local xlate = border_translators[part]
        local sides = _quarto.modules.typst.css.expand_side_shorthand(
          items,
          part .. 's in ' .. k .. ' list: ' .. v,
          _warnings)
        borders.top[xlate.prop] = sides.top
        borders.right[xlate.prop] = sides.right
        borders.bottom[xlate.prop] = sides.bottom
        borders.left[xlate.prop] = sides.left
      else
        _warnings:insert('invalid 2-item border key ' .. k)
      end
    elseif ndash == 2 then
      local side, prop = k:match('^border--(%a+)--(%a+)')
      if tcontains(border_sides, side) and tcontains(border_properties, prop) then
        borders[side] = borders[side] or {}
        local tr = border_translators[prop]
        borders[side][tr.prop] = tr.fn(v, _warnings)
      else
        _warnings:insert('invalid 3-item border key ' .. k)
      end
    else
      _warnings:insert('invalid too-many-item key ' .. k)
    end
  end

  local function annotate_cell(cell)
    local style = cell.attributes['style']
    if style ~= nil then
      local paddings = {}
      local aligns = {}
      local borders = {}
      local color = nil
      local opacity = nil
      for clause in style:gmatch('([^;]+)') do
        local k, v = to_kv(clause)
        if not k or not v then
          -- pass
        elseif k == 'background-color' then
          cell.attributes['typst:fill'] = _quarto.format.typst.css.output_color(_quarto.format.typst.css.parse_color(v, _warnings), nil, _warnings)
        elseif k == 'color' then
          color = _quarto.format.typst.css.parse_color(v, _warnings)
        elseif k == 'opacity' then
          opacity = _quarto.format.typst.css.parse_opacity(v, _warnings)
        elseif k == 'font-size' then
          cell.attributes['typst:text:size'] = _quarto.format.typst.css.translate_length(v, _warnings)
        elseif k == 'vertical-align' then
          local a = translate_vertical_align(v)
          if a then table.insert(aligns, a) end
        elseif k == 'text-align' then
          local a = translate_horizontal_align(v)
          if a then table.insert(aligns, a) end
        -- elseif k:find '^padding--' then
        --   paddings[k:match('^padding--(%a+)')] = _quarto.format.typst.css.translate_length(v, _warnings)
        elseif k:find '^border' then
          handle_border(k, v, borders)
        end
      end
      if next(aligns) ~= nil then
        cell.attributes['typst:align'] = table.concat(aligns, ' + ')
      end
      if color or opacity then
        cell.attributes['typst:text:fill'] = _quarto.format.typst.css.output_color(color, opacity, _warnings)
      end

      -- inset seems either buggy or hard to get right, see
      -- https://github.com/quarto-dev/quarto-cli/pull/9387#issuecomment-2076015962
      -- if next(paddings) ~= nil then
      --   cell.attributes['typst:inset'] = _quarto.modules.typst.as_typst_dictionary(paddings)
      -- end

      -- since e.g. the left side of one cell can override the right side of another
      -- we do not specify sides that have width=0 or style=none
      -- this assumes an additive model - currently no way to start with all lines
      -- and remove some
      local delsides = {}
      for side, attrs in pairs(borders) do
        if attrs.thickness == 'delete' or attrs.dash == 'delete' then
          table.insert(delsides, side)
        end
      end
      for _, dside in pairs(delsides) do
        borders[dside] = nil
      end
      if next(borders) ~= nil then
        -- if all are the same, use one stroke and don't split by side
        local thicknesses = {}
        local dashes = {}
        local paints = {}
        for _, side in ipairs(border_sides) do
          table.insert(thicknesses, borders[side] and borders[side].thickness or 0)
          table.insert(dashes, borders[side] and borders[side].dash or 0)
          table.insert(paints, borders[side] and borders[side].paint or 0)
        end
        quarto.log.debug('thicknesses', table.unpack(thicknesses))
        quarto.log.debug('dashes', table.unpack(dashes))
        quarto.log.debug('paints', table.unpack(paints))
        if all_equal(thicknesses) and all_equal(dashes) and all_equal(paints) then
          assert(borders.left)
          cell.attributes['typst:stroke'] = _quarto.modules.typst.as_typst_dictionary(borders.left)
        else
          cell.attributes['typst:stroke'] = _quarto.modules.typst.as_typst_dictionary(borders)
        end
      end
    end
    return cell
  end

  function annotate_span(span)
    span = annotate_cell(span) -- not really
    local style = span.attributes['style']
    local hlprops = {}
    if style ~= nil then
      for clause in style:gmatch('([^;]+)') do
        local k, v = to_kv(clause)
        if k == 'background-color' then
          hlprops.fill = _quarto.format.typst.css.output_color(_quarto.format.typst.css.parse_color(v, _warnings), nil, _warnings)
        end
      end
    end
    -- span borders can be added to #highlight() but it doesn't look good out of the box
    -- see https://github.com/quarto-dev/quarto-cli/pull/9619#issuecomment-2101936530
    -- if span.attributes['typst:stroke'] then
    --   hlprops.stroke = span.attributes['typst:stroke']
    --   span.attributes['typst:stroke'] = nil
    -- end
    if next(hlprops) ~= nil then
      if not hlprops.fill then
        hlprops.fill = 'rgb(0,0,0,0)'
      end
      return pandoc.Inlines({
        pandoc.RawInline('typst', '#highlight' .. _quarto.modules.typst.as_typst_dictionary(hlprops) .. '['),
        span,
        pandoc.RawInline('typst', ']')
      })
    end
    return span
  end

  local function translate_string_list(sl)
    local strings = {}
    for s in sl:gmatch('([^,]+)') do
      s = s:gsub('^%s+', '')
      table.insert(strings, quote(dequote(s)))
    end
    return '(' .. table.concat(strings, ', ') ..')'
  end
  
  return {
    Table = function(tab)
      _warnings = new_table()
      local tabstyle = tab.attributes['style']
      local has_typst_text = false
      if tabstyle ~= nil then
        for clause in tabstyle:gmatch('([^;]+)') do
          local k, v = to_kv(clause)
          if k == 'font-family' then
            tab.attributes['typst:text:font'] = translate_string_list(v)
            has_typst_text = true
          end
          if k == 'font-size' then
            tab.attributes['typst:text:size'] = _quarto.format.typst.css.translate_length(v, _warnings)
            has_typst_text = true
          end
        end
      end
      if tab.head then
        for _, row in ipairs(tab.head.rows) do
          for _, cell in ipairs(row.cells) do
            annotate_cell(cell)
          end
        end
      end
      for _, body in ipairs(tab.bodies) do
        for _, row in ipairs(body.body) do
          for _, cell in ipairs(row.cells) do
            annotate_cell(cell)
          end
        end
      end
      aggregate_warnings()
      _warnings = nil
      if not has_typst_text then return tab end
      -- wrap in typst content block and return false to prevent processing its contents
      return pandoc.Blocks({
        pandoc.RawBlock("typst", "#["),
        tab,
        pandoc.RawBlock("typst", "]")
      }), false
    end,
    Div = function(div)
      _warnings = new_table()
      local divstyle = div.attributes['style']
      if divstyle ~= nil then
        for clause in divstyle:gmatch('([^;]+)') do
          local k, v = to_kv(clause)
          if k == 'font-family' then
            div.attributes['typst:text:font'] = translate_string_list(v)
          elseif k == 'font-size' then
            div.attributes['typst:text:size'] = _quarto.format.typst.css.translate_length(v, _warnings)
          elseif k == 'background-color' then
            div.attributes['typst:fill'] = _quarto.format.typst.css.output_color(_quarto.format.typst.css.parse_color(v, _warnings), nil, _warnings)
          elseif k == 'color' then
            div.attributes['typst:text:fill'] = _quarto.format.typst.css.output_color(_quarto.format.typst.css.parse_color(v, _warnings), nil, _warnings)
          end
        end
      end
      aggregate_warnings()
      _warnings = nil
      return div
    end,
    Span = function(span)
      _warnings = new_table()
      span = annotate_span(span)
      aggregate_warnings()
      _warnings = nil
      return span
    end
  }
end