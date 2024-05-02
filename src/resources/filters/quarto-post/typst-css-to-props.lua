function render_typst_css_to_props()
  if not _quarto.format.isTypstOutput() then
    return {}
  end

  local function to_kv(prop_clause)
    return string.match(prop_clause, "([%w-]+)%s*:%s*(.*)$")
  end

  local css_named_colors = {
    transparent = 'rgb(0, 0, 0, 0)',
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

  local typst_named_colors = {
    'black',
    'gray',
    'silver',
    'white',
    'navy',
    'blue',
    'aqua',
    'teal',
    'eastern',
    'purple',
    'fuchsia',
    'maroon',
    'red',
    'orange',
    'yellow',
    'olive',
    'green',
    'lime',
  }
  

  local function translate_color (color)
    if color:sub(1, 1) == '#' then
      return 'rgb("' .. color .. '")'
    elseif tcontains(typst_named_colors, color) then
      return color
    end
    return css_named_colors[color]
  end

  local function sortedPairs (t, f)
    local a = {}
    for n in pairs(t) do table.insert(a, n) end
    table.sort(a, f)
    local i = 0      -- iterator variable
    local iter = function ()   -- iterator function
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

  -- standard conversion is 0.75px = 1pt
  -- but this seems a little large in practice?
  TEXT_PIXELS_TO_POINTS = 0.75
  PADDING_PIXELS_TO_POINTS = 0.75

  local function translate_string_list (sl)
    local strings = {}
    for s in sl:gmatch('([^,]+)') do
      s = s:gsub('^%s+', '')
      table.insert(strings, quote(dequote(s)))
    end
    return '(' .. table.concat(strings, ', ') ..')'
  end

  local function translate_size (fs, ratio)
    if not ratio then return fs end
    if fs:find 'px$' then
      if fs == '1px' then return ratio .. 'pt' end
      local pixels = fs:match '(%d+)px'
      local points = tonumber(pixels * ratio)
      return points .. 'pt'
    elseif fs == '0' then
      return '0pt'
    else
      return fs
    end
  end

  local function translate_font_size (fs, ratio)
    if fs:find '%%$' then
      local percent = tonumber(fs:match '(%d+)%%')
      return tostring(percent / 100) .. 'em'
    end
    return translate_size(fs, ratio)
  end

  local function translate_vertical_align(va)
    if va == "top" then
      return "top"
    elseif va == "middle" then
      return "horizon"
    elseif va == "bottom" then
      return "bottom"
    end
  end


  -- does the table contain a value
  local function tcontains(t,value)
    if t and type(t)=="table" and value then
      for _, v in ipairs (t) do
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
      if type(v) == "table" then
        v = to_typst_dict(v)
      end
      table.insert(entries, k .. ': ' .. v)
    end
    return '(' .. table.concat(entries, ', ') .. ')'
  end

  local function annotate_cell (cell)
    local style = cell.attributes['style']
    if style ~= nil then
      local paddings = {}
      local aligns = {}
      local borders = {}
      local delsides = {}
      for clause in style:gmatch('([^;]+)') do
        local k, v = to_kv(clause)
        if k == 'background-color' then
          cell.attributes['typst:fill'] = translate_color(v)
        elseif k == "color" then
          cell.attributes['typst:text:fill'] = translate_color(v)
        elseif k == 'font-size' then
          cell.attributes['typst:text:size'] = translate_font_size(v, TEXT_PIXELS_TO_POINTS)
        elseif k == 'vertical-align' then
          local a = translate_vertical_align(v)
          if a then table.insert(aligns, a) end
        elseif k == 'text-align' then
          local a = translate_horizontal_align(v)
          if a then table.insert(aligns, a) end
        elseif k:find '^padding--' then
          paddings[k:match('^padding--(%a+)')] = translate_size(v, PADDING_PIXELS_TO_POINTS)
        elseif k:find '^border--' then
          local side, attr = k:match('^border--(%a+)--(%a+)')
          if tcontains({'left','top','right','bottom'}, side) then
            borders[side] = borders[side] or {}
            if attr == "width" then
              local thickness = translate_size(v, PADDING_PIXELS_TO_POINTS)
              if thickness ~= "0pt" then
                borders[side]["thickness"] = thickness
              else
                table.insert(delsides, side)
              end
            elseif attr == "style" then
              if v == 'none' then
                table.insert(delsides, side)
              elseif tcontains({'dotted', 'dashed'}, v) then
                borders[side]['dash'] = quote(v)
              end
            elseif attr == "color" then
              borders[side]["paint"] = translate_color(v)
            end
          end
        end
      end
      -- since sides override eachother, we need to delete 0 width sides
      for _, dside in pairs(delsides) do
        borders[dside] = nil
      end
      if next(aligns) ~= nil then
        cell.attributes['typst:align'] = table.concat(aligns, ' + ')
      end
      -- inset seems either buggy or hard to get right, see
      -- https://github.com/quarto-dev/quarto-cli/pull/9387#issuecomment-2076015962
      -- if next(paddings) ~= nil then
      --   cell.attributes['typst:inset'] = to_typst_dict(paddings)
      -- end
      if next(borders) ~= nil then
        cell.attributes['typst:stroke'] = to_typst_dict(borders)
      end
    end
    return cell
  end 

  function annotate_span(span)
    span = annotate_cell(span) -- not really
    local style = span.attributes['style']
    local bkcolor = nil
    if style ~= nil then
      for clause in style:gmatch('([^;]+)') do
        local k, v = to_kv(clause)
        if k == 'background-color' then
          bkcolor = translate_color(v)
        end
      end
    end
    if bkcolor then
      return pandoc.Inlines({
        pandoc.RawInline('typst', '#highlight(fill: ' .. bkcolor .. ')['),
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
            tab.attributes['typst:text:size'] = translate_font_size(v, TEXT_PIXELS_TO_POINTS)
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
            div.attributes['typst:text:size'] = translate_font_size(v, TEXT_PIXELS_TO_POINTS)
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