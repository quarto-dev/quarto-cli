function render_typst_css_to_props()
  if not _quarto.format.isTypstOutput() then
    return {}
  end

  local function to_kv(prop_clause)
    return string.match(prop_clause, '([%w-]+)%s*:%s*(.*)$')
  end

  local css_named_colors = {
    transparent = 'rgba(0, 0, 0, 0)',
    aliceblue = 'rgb(240, 248, 255)',
    antiquewhite = 'rgb(250, 235, 215)',
    aqua = 'rgb(0, 255, 255)',
    aquamarine = 'rgb(127, 255, 212)',
    azure = 'rgb(240, 255, 255)',
    beige = 'rgb(245, 245, 220)',
    bisque = 'rgb(255, 228, 196)',
    black = 'rgb(0, 0, 0)',
    blanchedalmond = 'rgb(255, 235, 205)',
    blue = 'rgb(0, 0, 255)',
    blueviolet = 'rgb(138, 43, 226)',
    brown = 'rgb(165, 42, 42)',
    burlywood = 'rgb(222, 184, 135)',
    cadetblue = 'rgb(95, 158, 160)',
    chartreuse = 'rgb(127, 255, 0)',
    chocolate = 'rgb(210, 105, 30)',
    coral = 'rgb(255, 127, 80)',
    cornflowerblue = 'rgb(100, 149, 237)',
    cornsilk = 'rgb(255, 248, 220)',
    crimson = 'rgb(220, 20, 60)',
    cyan = 'rgb(0, 255, 255)',
    darkblue = 'rgb(0, 0, 139)',
    darkcyan = 'rgb(0, 139, 139)',
    darkgoldenrod = 'rgb(184, 134, 11)',
    darkgray = 'rgb(169, 169, 169)',
    darkgreen = 'rgb(0, 100, 0)',
    darkgrey = 'rgb(169, 169, 169)',
    darkkhaki = 'rgb(189, 183, 107)',
    darkmagenta = 'rgb(139, 0, 139)',
    darkolivegreen = 'rgb(85, 107, 47)',
    darkorange = 'rgb(255, 140, 0)',
    darkorchid = 'rgb(153, 50, 204)',
    darkred = 'rgb(139, 0, 0)',
    darksalmon = 'rgb(233, 150, 122)',
    darkseagreen = 'rgb(143, 188, 143)',
    darkslateblue = 'rgb(72, 61, 139)',
    darkslategray = 'rgb(47, 79, 79)',
    darkslategrey = 'rgb(47, 79, 79)',
    darkturquoise = 'rgb(0, 206, 209)',
    darkviolet = 'rgb(148, 0, 211)',
    deeppink = 'rgb(255, 20, 147)',
    deepskyblue = 'rgb(0, 191, 255)',
    dimgray = 'rgb(105, 105, 105)',
    dimgrey = 'rgb(105, 105, 105)',
    dodgerblue = 'rgb(30, 144, 255)',
    firebrick = 'rgb(178, 34, 34)',
    floralwhite = 'rgb(255, 250, 240)',
    forestgreen = 'rgb(34, 139, 34)',
    fuchsia = 'rgb(255, 0, 255)',
    gainsboro = 'rgb(220, 220, 220)',
    ghostwhite = 'rgb(248, 248, 255)',
    gold = 'rgb(255, 215, 0)',
    goldenrod = 'rgb(218, 165, 32)',
    gray = 'rgb(128, 128, 128)',
    green = 'rgb(0, 128, 0)',
    greenyellow = 'rgb(173, 255, 47)',
    grey = 'rgb(128, 128, 128)',
    honeydew = 'rgb(240, 255, 240)',
    hotpink = 'rgb(255, 105, 180)',
    indianred = 'rgb(205, 92, 92)',
    indigo = 'rgb(75, 0, 130)',
    ivory = 'rgb(255, 255, 240)',
    khaki = 'rgb(240, 230, 140)',
    lavender = 'rgb(230, 230, 250)',
    lavenderblush = 'rgb(255, 240, 245)',
    lawngreen = 'rgb(124, 252, 0)',
    lemonchiffon = 'rgb(255, 250, 205)',
    lightblue = 'rgb(173, 216, 230)',
    lightcoral = 'rgb(240, 128, 128)',
    lightcyan = 'rgb(224, 255, 255)',
    lightgoldenrodyellow = 'rgb(250, 250, 210)',
    lightgray = 'rgb(211, 211, 211)',
    lightgreen = 'rgb(144, 238, 144)',
    lightgrey = 'rgb(211, 211, 211)',
    lightpink = 'rgb(255, 182, 193)',
    lightsalmon = 'rgb(255, 160, 122)',
    lightseagreen = 'rgb(32, 178, 170)',
    lightskyblue = 'rgb(135, 206, 250)',
    lightslategray = 'rgb(119, 136, 153)',
    lightslategrey = 'rgb(119, 136, 153)',
    lightsteelblue = 'rgb(176, 196, 222)',
    lightyellow = 'rgb(255, 255, 224)',
    lime = 'rgb(0, 255, 0)',
    limegreen = 'rgb(50, 205, 50)',
    linen = 'rgb(250, 240, 230)',
    magenta = 'rgb(255, 0, 255)',
    maroon = 'rgb(128, 0, 0)',
    mediumaquamarine = 'rgb(102, 205, 170)',
    mediumblue = 'rgb(0, 0, 205)',
    mediumorchid = 'rgb(186, 85, 211)',
    mediumpurple = 'rgb(147, 112, 219)',
    mediumseagreen = 'rgb(60, 179, 113)',
    mediumslateblue = 'rgb(123, 104, 238)',
    mediumspringgreen = 'rgb(0, 250, 154)',
    mediumturquoise = 'rgb(72, 209, 204)',
    mediumvioletred = 'rgb(199, 21, 133)',
    midnightblue = 'rgb(25, 25, 112)',
    mintcream = 'rgb(245, 255, 250)',
    mistyrose = 'rgb(255, 228, 225)',
    moccasin = 'rgb(255, 228, 181)',
    navajowhite = 'rgb(255, 222, 173)',
    navy = 'rgb(0, 0, 128)',
    oldlace = 'rgb(253, 245, 230)',
    olive = 'rgb(128, 128, 0)',
    olivedrab = 'rgb(107, 142, 35)',
    orange = 'rgb(255, 165, 0)',
    orangered = 'rgb(255, 69, 0)',
    orchid = 'rgb(218, 112, 214)',
    palegoldenrod = 'rgb(238, 232, 170)',
    palegreen = 'rgb(152, 251, 152)',
    paleturquoise = 'rgb(175, 238, 238)',
    palevioletred = 'rgb(219, 112, 147)',
    papayawhip = 'rgb(255, 239, 213)',
    peachpuff = 'rgb(255, 218, 185)',
    peru = 'rgb(205, 133, 63)',
    pink = 'rgb(255, 192, 203)',
    plum = 'rgb(221, 160, 221)',
    powderblue = 'rgb(176, 224, 230)',
    purple = 'rgb(128, 0, 128)',
    red = 'rgb(255, 0, 0)',
    rosybrown = 'rgb(188, 143, 143)',
    royalblue = 'rgb(65, 105, 225)',
    saddlebrown = 'rgb(139, 69, 19)',
    salmon = 'rgb(250, 128, 114)',
    sandybrown = 'rgb(244, 164, 96)',
    seagreen = 'rgb(46, 139, 87)',
    seashell = 'rgb(255, 245, 238)',
    sienna = 'rgb(160, 82, 45)',
    silver = 'rgb(192, 192, 192)',
    skyblue = 'rgb(135, 206, 235)',
    slateblue = 'rgb(106, 90, 205)',
    slategray = 'rgb(112, 128, 144)',
    slategrey = 'rgb(112, 128, 144)',
    snow = 'rgb(255, 250, 250)',
    springgreen = 'rgb(0, 255, 127)',
    steelblue = 'rgb(70, 130, 180)',
    tan = 'rgb(210, 180, 140)',
    teal = 'rgb(0, 128, 128)',
    thistle = 'rgb(216, 191, 216)',
    tomato = 'rgb(255, 99, 71)',
    turquoise = 'rgb(64, 224, 208)',
    violet = 'rgb(238, 130, 238)',
    wheat = 'rgb(245, 222, 179)',
    white = 'rgb(255, 255, 255)',
    whitesmoke = 'rgb(245, 245, 245)',
    yellow = 'rgb(255, 255, 0)',
    yellowgreen = 'rgb(154, 205, 50)',
  }

  -- note that these are not always the same as css colors of the same name
  -- we use these anyway, but it could cause a hue change when adding opacity
  -- to one of these colors because we'll switch from typst to css interpretation
  local typst_named_colors = {
    black = '#000',
    gray = '#aaa',
    silver = '#ddd',
    white = '#fff',
    navy = '#001f3f',
    blue = '#0074d9',
    aqua = '#7fdbff',
    teal = '#39cccc',
    eastern = '#239dad',
    purple = '#b10dc9',
    fuchsia = '#f012be',
    maroon = '#85144b',
    red = '#ff4136',
    orange = '#ff851b',
    yellow = '#ffdc00',
    olive = '#3d9970',
    green = '#2ecc40',
    lime = '#01ff70',
  }
  -- css can have fraction or percent
  -- typst can have int or percent
  -- what goes for opacity also goes for alpha
  local function translate_opacity(opacity)
    if not opacity then
      return nil
    end
    if opacity == 'none' then
      return {
        unit = 'percent',
        value = 100
      }
    elseif opacity:find '%%$' then
      return {
        unit = 'percent',
        value = tonumber(opacity:sub(1, -2), 10)
      }
    else
      return {
        unit = 'fraction',
        value = math.min(1.0, tonumber(opacity))
      }
    end
  end
  local function parse_color_components(matches)
    local comps = {}
    for comp in matches do
      if #comps == 3 then
        table.insert(comps, translate_opacity(comp))
      else
        if comp == 'none' then
          table.insert(comps, {
            unit = 'percent',
            value = 0
          })
        elseif comp:find '%%$' then
          table.insert(comps, {
            unit = 'percent',
            value = tonumber(comp:sub(1, -2))
          })
        else
          table.insert(comps, {
            unit = 'int',
            value = tonumber(comp)
          })
        end
      end
    end
    return comps
  end
  local function parse_rgb(text)
    local parms = text:match('rgba?%((.*)%)')
    local colorspace = 'rgb'
    if not parms then return nil end
    local _, ncomma = parms:gsub(',', '')
    local comps
    if ncomma ~= 0 then -- legacy comma-separated syntax
      if ncomma > 1 and ncomma < 4 then
        local matches = parms:gmatch('([%w.]+%%?),?')
        if not matches then return nil end
        comps = parse_color_components(matches)
      else
        quarto.log.warning(colorspace .. ' should have 3-4 components', text)
        return nil
      end
    else
      local _, nslash = parms:gsub('/', '')
      local colors, alpha
      if nslash > 0 then
        if nslash > 1 then
          quarto.log.warning(colorspace .. ' with multiple slashes', text)
          return nil
        end
        colors, alpha = parms:match('(.*) */ *(.*)')
      else
        colors = parms
        alpha = ''
      end
      local matches = colors:gmatch('([%w.]+%%?) *')
      if not matches then return nil end
      comps = parse_color_components(matches)
      if alpha ~= '' then
        local alphacomp = translate_opacity(alpha)
        comps[4] = alphacomp
      end
    end
    return {
      type = 'rgb',
      value = comps
    }
  end

  local function parse_color(color)
    if color:sub(1, 1) == '#' then
      local value = color:sub(2)
      local short = value:len() < 5
      local comps = {}
      if short then
        for c in value:gmatch '.' do
          table.insert(comps, {
            unit = 'hex',
            value = tonumber(c .. c, 16)
          })
        end
      else
        for cc in value:gmatch '..' do
          table.insert(comps, {
            unit = 'hex',
            value = tonumber(cc, 16)
          })
        end
      end
      return {
        type = 'rgb',
        value = comps,
        rep = short and 'shorthex' or 'hex'
      }
    elseif color:find '^rgb%(' or color:find '^rgba%(' then
      return parse_rgb(color)
    elseif css_named_colors[color] then
      return {
        type = 'named',
        value = color
      }
    end
    quarto.log.warning('invalid color', color)
    return nil
  end
  local function format_float(x)
    local f = string.format('%.2f', x)
    -- trim zeros after decimal point
    return f:gsub('%.00', ''):gsub('%.(%d)0', '.%1')
  end
  local function percent_string(x)
    return format_float(x) .. '%'
  end
  local function output_color_opacity(color, opacity)
    quarto.log.debug('output_color_opacity input', color, opacity)
    if opacity then
      if not color then
        zero = {
          unit = 'int',
          value = 0
        }
        color = {
          type = 'rgb',
          value = {zero, zero, zero}
        }
      end
      if color.type == 'named' then
        if not typst_named_colors[color.value] and not css_named_colors[color.value] then
          quarto.log.warning('unknown color ' .. color.value)
          return nil
        end
        color = parse_color(typst_named_colors[color.value] or css_named_colors[color.value])
      end
      local mult = 1
      if opacity.unit == 'int' then
        mult = opacity.value / 255.9999
      elseif opacity.unit == 'percent' then
        mult = opacity.value / 100.0
      else
        assert(opacity.unit == 'fraction', 'invalid unit ' .. opacity.unit)
        mult = opacity.value
      end
      -- prefer percent/ratio output if not specified
      if not color.value[4] then
        color.value[4] = {
          unit = 'percent',
          value = 100
        }
      end
      color.value[4].value = color.value[4].value * mult
      if color.value[4].unit == 'int' then
        color.value[4].value = math.floor(color.value[4].value)
      end
    else
      if not color then return nil end
      if color.type == 'named' then
        if typst_named_colors[color.value] then
          return color.value
        elseif css_named_colors[color.value] then
          color = parse_rgb(css_named_colors[color.value])
        else
          return nil
        end
      end
    end
    quarto.log.debug('output_color_opacity output', color)
    if color.value[4] and color.value[4].unit == 'fraction' then
      color.value[4] = {
        unit = 'percent',
        value = color.value[4].value * 100
      }
    end
    if not color.rep then
      local fmtd = {}
      for _, comp in ipairs(color.value) do
        if comp.unit == 'int' then
          table.insert(fmtd, tostring(comp.value))
        elseif comp.unit == 'percent' then
          table.insert(fmtd, percent_string(comp.value))
        else
          assert(false, 'invalid unit ' .. comp.unit)
        end
      end
      return 'rgb(' .. table.concat(fmtd, ', ') .. ')'
    else
      if color.value[4] and color.value[4].unit ~= 'hex' then
        if color.value[4].unit == 'percent' then
          color.value[4] = {
            unit = 'hex',
            value = math.floor(color.value[4].value * 255.9999 / 100.0)
          }
        elseif color.value[4].unit == 'int' then
          color.value[4].unit = 'hex'
        end
      end
      local hexes = {}
      if color.rep == 'shorthex' then
        for i, comp in ipairs(color.value) do
          -- take upper nibble
          assert(comp.unit == 'hex', 'comp ' .. i .. ' invalid unit ' .. comp.unit)
          table.insert(hexes, string.format('%x', comp.value):sub(1,1))
        end
      elseif color.rep == 'hex' then
        for i, comp in ipairs(color.value) do
          assert(comp.unit == 'hex', 'comp ' .. i .. ' invalid unit ' .. comp.unit)
          table.insert(hexes, string.format('%02x', comp.value))
        end
      else
        assert(false, 'invalid rep ' .. color.rep)
      end
      quarto.log.debug('output_color_opacity hex output', table.unpack(hexes))
      return 'rgb("#' .. table.concat(hexes, '') .. '")'
    end
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

  local function dequote(s)
    return s:gsub('^["\']', ''):gsub('["\']$', '')
  end

  local function quote(s)
    return '"' .. s .. '"'
  end

  local length_units = {
    -- font-relative
    'em', 'rem', 'ex', 'rex', 'cap', 'rcap', 'ch', 'rch', 'ic', 'ric', 'lh', 'rlh',
    -- viewport-relative
    'vw', 'svw', 'lvw', 'dvw', 'vh', 'svh', 'lvh', 'dvh',
    'vi', 'svi', 'lvi', 'dvi', 'vb', 'svb', 'lvb', 'dvb',
    'vmin', 'svmin', 'lvmin', 'dvmin ', 'vmax', 'svmax', 'lvmax', 'dvmax',
    -- absolute
    'cm', 'mm', 'Q', 'in', 'pt', 'pc', 'px',
    -- not really a length unit, but used for font-size
    '%'
  }
  -- sort longest to shortest to find most specific
  table.sort(length_units, function(a, b) return #a > #b end)

  PIXELS_TO_POINTS = 0.75

  local function translate_string_list(sl)
    local strings = {}
    for s in sl:gmatch('([^,]+)') do
      s = s:gsub('^%s+', '')
      table.insert(strings, quote(dequote(s)))
    end
    return '(' .. table.concat(strings, ', ') ..')'
  end

  local function has_any_suffix(s, suffixes)
    for _, suff in ipairs(suffixes) do
      local suff2 = suff == '%' and '%%' or suff
      if s:find(suff2 .. '$') then
        return suff
      end
    end
    return nil
  end

  local function passthrough(_, csslen) return csslen end

  local css_lengths = {
    px = function(val, _)
      local points = val * PIXELS_TO_POINTS
      return format_float(points) .. 'pt'
    end,
    pt = passthrough,
    ['in'] = passthrough,
    cm = passthrough,
    mm = passthrough,
    ['%'] = function(val, _)
      return tostring(val / 100) .. 'em'
    end,
  }

  local function translate_length(csslen)
    local unit = has_any_suffix(csslen, length_units)
    if not unit then
      if csslen == '0' then
        return '0pt'
      end
      quarto.log.warning('not a length ', csslen)
      return nil
    end
    local nums = csslen:sub(1, -#unit - 1)
    -- lua regex for number
    -- https://stackoverflow.com/a/56694730
    if not nums:match '^([+-]?%d*%.?%d+)%.?$' then
      local numpart = nums:match '^([+-]?%d*%.?%d+)%.?'
      if not numpart then
        quarto.log.warning('not a number ' .. nums .. ' for unit ' .. unit .. ' in ' .. csslen)
        return nil
      else
        quarto.log.warning('bad unit ' .. csslen:sub(#numpart + 1, -1) .. ' for number ' .. numpart .. ' in ' .. csslen)
        return nil
      end
    end
    local val = tonumber(nums)
    if not val then
      quarto.log.warning('not a number ' .. nums .. ' for unit ' .. unit .. ' in ' .. csslen)
      return nil
     end
    local csf = css_lengths[unit]
    if not csf then
      quarto.log.warning('unit ' .. unit .. ' is not supported in ' .. csslen )
      return nil
    end
    return csf(val, csslen)
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

  local function to_typst_dict(tab)
    local entries = {}
    for k, v in sortedPairs(tab) do
      if type(v) == 'table' then
        v = to_typst_dict(v)
      end
      if k and v then
        table.insert(entries, k .. ': ' .. v)
      end
    end
    if #entries == 0 then return nil end
    return '(' .. table.concat(entries, ', ') .. ')'
  end

  local border_sides = {'left', 'top', 'right', 'bottom'}
  local border_properties = {'width', 'style', 'color'}
  local border_width_keywords = {
    thin = '1px',
    medium = '3px',
    thick = '5px'
  }

  local function all_equal(seq)
    local a = seq[1]
    for i = 2, #seq do
      if a ~= seq[i] then
        return false
      end
    end
    return true
  end

  local function translate_border_width(v)
    v = border_width_keywords[v] or v
    local thickness = translate_length(v)
    return thickness == '0pt' and 'delete' or thickness
  end

  local function translate_border_style(v)
    local dash
    if v == 'none' then
      return 'delete'
    elseif tcontains({'dotted', 'dashed'}, v) then
      return quote(v)
    end
    return nil
  end

  local function translate_border_color(v)
    return output_color_opacity(parse_color(v), nil)
  end

  local border_translators = {
    width = {
      prop = 'thickness',
      fn = translate_border_width
    },
    style = {
      prop = 'dash',
      fn = translate_border_style
    },
    color = {
      prop = 'paint',
      fn = translate_border_color
    }
  }

  -- only a few of these map to typst, again seems simplest to parse anyway
  local border_styles = {
    'none', 'hidden', 'dotted', 'dashed', 'solid', 'double', 'groove', 'ridge', 'inset', 'outset', 'inherit', 'initial', 'revert', 'revert-layer', 'unset'
  }

  function parse_multiple(s, limit, callback)
    local start = 0
    local count = 0
    repeat
      start = callback(s, start)
      -- not really necessary with string:find
      -- as evidenced that s.sub also works
      while s:sub(start, start) == ' ' do
        start = start + 1
      end
      count = count + 1
    until count >=limit or start >= #s
  end

  -- border shorthand
  -- https://developer.mozilla.org/en-US/docs/Web/CSS/border
  local function translate_border(v)
    -- not sure why the default style that works is not the same one specified
    local width = 'medium'
    local style = 'solid' -- css specifies none
    local paint = 'black' -- css specifies currentcolor
    parse_multiple(v, 3, function(s, start)
      local fbeg, fend = s:find('%w+%b()', start)
      if fbeg then
        local paint2 = translate_border_color(s:sub(fbeg, fend))
        if paint2 then
          paint = paint2
        end
        return fend + 1
      else
        fbeg, fend = s:find('%S+', start)
        local term = v:sub(fbeg, fend)
        if tcontains(border_styles, term) then
          style = term
        else
          if has_any_suffix(term, length_units) or border_width_keywords[term] then
            width = term
          else
            local paint2 = translate_border_color(term)
            if paint2 then
              paint = paint2
            else
              quarto.log.warning('invalid border shorthand', term)
            end
          end
        end
        return fend + 1
      end
    end)
    return {
      thickness = translate_border_width(width),
      dash = translate_border_style(style),
      paint = paint
    }
  end

  local function consume_width(s, start)
      fbeg, fend = s:find('%S+', start)
      local term = s:sub(fbeg, fend)
      local thickness = translate_border_width(term)
      return thickness, fend + 1
  end

  local function consume_style(s, start)
    fbeg, fend = s:find('%S+', start)
    local term = s:sub(fbeg, fend)
    local dash = translate_border_style(term)
    return dash, fend + 1
  end

  local function consume_color(s, start)
    local fbeg, fend = s:find('%w+%b()', start)
    if not fbeg then
      fbeg, fend = s:find('%S+', start)
    end
    if not fbeg then return nil end
    local paint = translate_border_color(s:sub(fbeg, fend))
    return paint, fend + 1
  end

  local border_consumers = {
    width = consume_width,
    style = consume_style,
    color = consume_color,
  }
  local function handle_border(k, v, borders)
    local _, ndash = k:gsub('-', '')
    if ndash == 0 then
      local border = translate_border(v)
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
        local border = translate_border(v)
        for k2, v2 in pairs(border) do
          borders[part][k2] = v2
        end
      elseif tcontains(border_properties, part) then
        local items = {}
        parse_multiple(v, 4, function(s, start)
          local item, newstart = border_consumers[part](s, start)
          table.insert(items, item)
          return newstart
        end)
        for _, side in ipairs(border_sides) do
          borders[side] = borders[side] or {}
        end
        local xlate = border_translators[part]
        if #items == 0 then
          quarto.log.warning('no valid ' .. part .. 's in ' .. v)
        -- the most css thing ever
        elseif #items == 1 then
          borders.top[xlate.prop] = items[1]
          borders.right[xlate.prop] = items[1]
          borders.bottom[xlate.prop] = items[1]
          borders.left[xlate.prop] = items[1]
        elseif #items == 2 then
          borders.top[xlate.prop] = items[1]
          borders.right[xlate.prop] = items[2]
          borders.bottom[xlate.prop] = items[1]
          borders.left[xlate.prop] = items[2]
        elseif #items == 3 then
          borders.top[xlate.prop] = items[1]
          borders.right[xlate.prop] = items[2]
          borders.bottom[xlate.prop] = items[3]
          borders.left[xlate.prop] = items[2]
        elseif #items == 4 then
          borders.top[xlate.prop] = items[1]
          borders.right[xlate.prop] = items[2]
          borders.bottom[xlate.prop] = items[3]
          borders.left[xlate.prop] = items[4]
        else
          quarto.log.warning('too many values in ' .. k .. ' list: ' .. v)
        end
      else
        quarto.log.warning('invalid 2-item border key ' .. k)
      end
    elseif ndash == 2 then
      local side, prop = k:match('^border--(%a+)--(%a+)')
      if tcontains(border_sides, side) and tcontains(border_properties, prop) then
        borders[side] = borders[side] or {}
        local tr = border_translators[prop]
        borders[side][tr.prop] = tr.fn(v)
      else
        quarto.log.warning('invalid 3-item border key ' .. k)
      end
    else
      quarto.log.warning('invalid too-m_-item key ' .. k)
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
          cell.attributes['typst:fill'] = output_color_opacity(parse_color(v), nil)
        elseif k == 'color' then
          color = parse_color(v)
        elseif k == 'opacity' then
          opacity = translate_opacity(v)
        elseif k == 'font-size' then
          cell.attributes['typst:text:size'] = translate_length(v)
        elseif k == 'vertical-align' then
          local a = translate_vertical_align(v)
          if a then table.insert(aligns, a) end
        elseif k == 'text-align' then
          local a = translate_horizontal_align(v)
          if a then table.insert(aligns, a) end
        elseif k:find '^padding--' then
          paddings[k:match('^padding--(%a+)')] = translate_length(v)
        elseif k:find '^border' then
          handle_border(k, v, borders)
        end
      end
      if next(aligns) ~= nil then
        cell.attributes['typst:align'] = table.concat(aligns, ' + ')
      end
      if color or opacity then
        cell.attributes['typst:text:fill'] = output_color_opacity(color, opacity)
      end

      -- inset seems either buggy or hard to get right, see
      -- https://github.com/quarto-dev/quarto-cli/pull/9387#issuecomment-2076015962
      -- if next(paddings) ~= nil then
      --   cell.attributes['typst:inset'] = to_typst_dict(paddings)
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
          cell.attributes['typst:stroke'] = to_typst_dict(borders.left)
        else
          cell.attributes['typst:stroke'] = to_typst_dict(borders)
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
          hlprops.fill = output_color_opacity(parse_color(v), nil)
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
        pandoc.RawInline('typst', '#highlight' .. to_typst_dict(hlprops) .. '['),
        span,
        pandoc.RawInline('typst', ']')
      })
    end
    return span
  end

  return {
    Table = function(tab)
      local tabstyle = tab.attributes['style']
      if tabstyle ~= nil then
        for clause in tabstyle:gmatch('([^;]+)') do
          local k, v = to_kv(clause)
          if k == 'font-family' then
            tab.attributes['typst:text:font'] = translate_string_list(v)
          end
          if k == 'font-size' then
            tab.attributes['typst:text:size'] = translate_length(v)
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
      return tab
    end,
    Div = function(div)
      local divstyle = div.attributes['style']
      if divstyle ~= nil then
        for clause in divstyle:gmatch('([^;]+)') do
          local k, v = to_kv(clause)
          if k == 'font-family' then
            div.attributes['typst:text:font'] = translate_string_list(v)
          end
          if k == 'font-size' then
            div.attributes['typst:text:size'] = translate_length(v)
          end
        end
      end
      return div
    end,
    Span = function(span)
      return annotate_span(span)
    end
  }
end