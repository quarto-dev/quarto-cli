function render_typst_css_to_props()
  if not _quarto.format.isTypstOutput() then
    return {}
  end
  local function to_kv(prop_clause)
    return string.match(prop_clause, "([%w-]+)%s*:%s*(.*)$")
  end

  local function translate_color (color)
    if color:sub(1, 1) == '#' then
      return 'rgb("' .. color .. '")'
    else
      return color
    end
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
      local points = math.floor(tonumber(pixels * ratio))
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
      if next(paddings) ~= nil then
        cell.attributes['typst:inset'] = to_typst_dict(paddings)
      end
      if next(borders) ~= nil then
        cell.attributes['typst:stroke'] = to_typst_dict(borders)
      end
    end
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
    end
  }
end