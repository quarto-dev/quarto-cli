-- translation of CSS values to Typst values
-- this module is exposed as quarto.format.typst.css

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
local function parse_opacity(opacity)
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
      table.insert(comps, parse_opacity(comp))
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
local function output_warning(warnings, message)
  if warnings then
    warnings:insert(message)
  else
    quarto.log.warning(message)
  end
end
local function parse_rgb(text, warnings)
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
      output_warning(warnings, colorspace .. ' should have 3-4 components ' .. text)
      return nil
    end
  else
    local _, nslash = parms:gsub('/', '')
    local colors, alpha
    if nslash > 0 then
      if nslash > 1 then
        output_warning(warnings, colorspace .. ' with multiple slashes ' .. text)
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
      local alphacomp = parse_opacity(alpha)
      comps[4] = alphacomp
    end
  end
  return {
    type = 'rgb',
    value = comps
  }
end

local function parse_color(color, warnings)
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
  elseif color:find '^var%(%-%-brand%-' then
    local colorName = color:match '^var%(%-%-brand%-([%a--]*)%)'
    if not colorName then
      output_warning(warnings, 'invalid brand color reference ' .. v)
      return null
    end
    return colorName and {
      type = 'brand',
      value = colorName
    }
  elseif css_named_colors[color] then
    return {
      type = 'named',
      value = color
    }
  end
  output_warning(warnings, 'invalid color ' .. color)
  return nil
end

local function percent_string(x)
  return format_typst_float(x) .. '%'
end

local function output_color(color, opacity, warnings)
  quarto.log.debug('output_color input', color, opacity)
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
        output_warning(warnings, 'unknown color ' .. color.value)
        return nil
      end
      color = parse_color(typst_named_colors[color.value] or css_named_colors[color.value])
    elseif color.type == 'brand' then
      local cssColor = _quarto.modules.brand.get_color_css(color.value)
      if not cssColor then
        output_warning(warnings, 'unknown brand color ' .. color.value)
        return nil
      end
      color = _quarto.format.typst.css.parse_color(cssColor)
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
    elseif color.type == 'brand' then
      local cssColor = _quarto.modules.brand.get_color_css(color.value)
      if not cssColor then
        output_warning(warnings, 'unknown brand color ' .. color.value)
        return nil
      end
      return 'brand-color.' .. color.value
    end
  end
  quarto.log.debug('output_color output', color)
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
    quarto.log.debug('output_color hex output', table.unpack(hexes))
    return 'rgb("#' .. table.concat(hexes, '') .. '")'
  end
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

local PIXELS_TO_POINTS = 0.75

local function has_any_suffix(s, suffixes)
  for _, suff in ipairs(suffixes) do
    local suff2 = suff == '%' and '%%' or suff
    if s:find(suff2 .. '$') then
      return suff
    end
  end
  return nil
end

local function parse_length_unit(s)
  return has_any_suffix(s, length_units)
end

local function passthrough(_, _, csslen) return csslen end

local parse_length

local css_lengths = {
  px = function(val, _, _)
    local points = val * PIXELS_TO_POINTS
    return format_typst_float(points) .. 'pt'
  end,
  pt = passthrough,
  ['in'] = passthrough,
  cm = passthrough,
  mm = passthrough,
  em = passthrough,
  rem = function(val, _, _, warnings)
    local base = _quarto.modules.brand.get_typography('base')
    if base and base.size then
      local base_size = parse_length(base.size)
      if not base_size then
        output_warning(warnings, 'could not parse base size ' .. base.size .. ', defaulting rem to em')
        return val .. 'em'
      end
      return val .. '*' .. base.size
    else
      output_warning(warnings, 'no brand.typography.base.size, defaulting rem to em')
      return val .. 'em'
    end
  end,
  ['%'] = function(val, _, _)
    return tostring(val / 100) .. 'em'
  end,
}

parse_length = function(csslen, warnings)
  local unit = parse_length_unit(csslen)
  if not unit then
    if csslen == '0' then
      return {
        value = 0,
        unit = 'pt',
        csslen = csslen
      }
    end
    output_warning(warnings, 'not a length ' .. csslen)
    return nil
  end
  local nums = csslen:sub(1, -#unit - 1)
  -- lua regex for number
  -- https://stackoverflow.com/a/56694730
  if not nums:match '^([+-]?%d*%.?%d+)%.?$' then
    local numpart = nums:match '^([+-]?%d*%.?%d+)%.?'
    if not numpart then
      output_warning(warnings, 'not a number ' .. nums .. ' for unit ' .. unit .. ' in ' .. csslen)
      return nil
    else
      output_warning(warnings, 'bad unit ' .. csslen:sub(#numpart + 1, -1) .. ' for number ' .. numpart .. ' in ' .. csslen)
      return nil
    end
  end
  local val = tonumber(nums)
  if not val then
    output_warning(warnings, 'not a number ' .. nums .. ' for unit ' .. unit .. ' in ' .. csslen)
    return nil
    end
  return {
    value = val,
    unit = unit,
    csslen = csslen
  }
end

local function output_length(length, warnings)
  local csf = css_lengths[length.unit]
  if not csf then
    output_warning(warnings, 'unit ' .. length.unit .. ' is not supported in ' .. length.csslen )
    return nil
  end 
  return csf(length.value, length.unit, length.csslen, warnings)
end

local function translate_length(csslen, warnings)
  local length = parse_length(csslen, warnings)
  return length and output_length(length, warnings)
end

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

local border_width_keywords = {
  thin = '1px',
  medium = '3px',
  thick = '5px'
}

local function translate_border_width(v, warnings)
  v = border_width_keywords[v] or v
  local thickness = translate_length(v, warnings)
  return thickness == '0pt' and 'delete' or thickness
end

local function quote(s)
  return '"' .. s .. '"'
end

local function translate_border_style(v, _warnings)
  local dash
  if v == 'none' then
    return 'delete'
  elseif tcontains({'dotted', 'dashed'}, v) then
    return quote(v)
  end
  return nil
end

local function translate_border_color(v, warnings)
  return output_color(parse_color(v, warnings), nil, warnings)
end

-- border shorthand
-- https://developer.mozilla.org/en-US/docs/Web/CSS/border
local function translate_border(v, warnings)
  -- not sure why the default style that works is not the same one specified
  local width = 'medium'
  local style = 'solid' -- css specifies none
  local paint = 'black' -- css specifies currentcolor
  parse_multiple(v, 3, function(s, start)
    local fbeg, fend = s:find('%w+%b()', start)
    if fbeg then
      local paint2 = translate_border_color(s:sub(fbeg, fend), warnings)
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
        if parse_length_unit(term) or border_width_keywords[term] then
          width = term
        else
          local paint2 = translate_border_color(term, warnings)
          if paint2 then
            paint = paint2
          else
            output_warning(warnings, 'invalid border shorthand ' .. term)
          end
        end
      end
      return fend + 1
    end
  end)
  return {
    thickness = translate_border_width(width, warnings),
    dash = translate_border_style(style, warnings),
    paint = paint
  }
end

local function consume_width(s, start, warnings)
    fbeg, fend = s:find('%S+', start)
    local term = s:sub(fbeg, fend)
    local thickness = translate_border_width(term, warnings)
    return thickness, fend + 1
end

local function consume_style(s, start, warnings)
  fbeg, fend = s:find('%S+', start)
  local term = s:sub(fbeg, fend)
  local dash = translate_border_style(term, warnings)
  return dash, fend + 1
end

local function consume_color(s, start, warnings)
  local fbeg, fend = s:find('%w+%b()', start)
  if not fbeg then
    fbeg, fend = s:find('%S+', start)
  end
  if not fbeg then return nil end
  local paint = translate_border_color(s:sub(fbeg, fend), warnings)
  return paint, fend + 1
end

-- the most css thing ever
local function expand_side_shorthand(items, context, warnings)
  local sides = {}
  if #items == 0 then
    output_warning(warnings, 'no valid ' .. context)
  elseif #items == 1 then
    sides.top = items[1]
    sides.right = items[1]
    sides.bottom = items[1]
    sides.left = items[1]
  elseif #items == 2 then
    sides.top = items[1]
    sides.right = items[2]
    sides.bottom = items[1]
    sides.left = items[2]
  elseif #items == 3 then
    sides.top = items[1]
    sides.right = items[2]
    sides.bottom = items[3]
    sides.left = items[2]
  elseif #items == 4 then
    sides.top = items[1]
    sides.right = items[2]
    sides.bottom = items[3]
    sides.left = items[4]
  else
    output_warning(warnings, 'too many ' .. context)
  end
  return sides
end

return {
  parse_color = parse_color,
  parse_opacity = parse_opacity,
  output_color = output_color,
  parse_length_unit = parse_length_unit,
  parse_length = parse_length,
  output_length = output_length,
  translate_length = translate_length,
  parse_multiple = parse_multiple,
  expand_side_shorthand = expand_side_shorthand,
  translate_border = translate_border,
  translate_border_width = translate_border_width,
  translate_border_style = translate_border_style,
  translate_border_color = translate_border_color,
  consume_width = consume_width,
  consume_style = consume_style,
  consume_color = consume_color
}
