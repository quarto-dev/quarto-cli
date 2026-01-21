local io     = require 'io'
local pandoc = require 'pandoc'
local utils  = require 'pandoc.utils'
local ptype  = utils.type

local InlinesMT = debug.getmetatable(pandoc.Inlines{})
local BlocksMT = debug.getmetatable(pandoc.Blocks{})

local InlineTypes = {
  Cite = {
    citation = 'List',
    content = 'Inlines',
  },
  Code = {
    attr = 'Attr',
    text = 'string',
  },
  Emph = {
    content = 'Inlines',
  },
  Image = {
    attr = 'Attr',
    caption = 'Inlines',
    src = 'string',
    title = 'string',
  },
  LineBreak = {
  },
  Link = {
    attr = 'Attr',
    content = 'Inlines',
    target = 'string',
    title = 'string',
  },
  Math = {
    mathtype = 'string',
    text = 'string',
  },
  Note = {
    content = 'Blocks',
  },
  Quoted = {
    content = 'Inlines',
    quotetype = 'string',
  },
  RawInline = {
    format = 'string',
    text = 'string',
  },
  SmallCaps = {
    content = 'Inlines',
  },
  SoftBreak = {
  },
  Space = {
  },
  Str = {
    text = 'string',
  },
  Span = {
    attr = 'Attr',
    content = 'Inlines',
  },
  Strikeout = {
    content = 'Inlines',
  },
  Strong = {
    content = 'Inlines',
  },
  Subscript = {
    content = 'Inlines',
  },
  Superscript = {
    content = 'Inlines',
  },
  Underline = {
    content = 'Inlines',
  },
}

local BlockTypes = {
  BlockQuote = {
    content = 'Blocks',
  },
  BulletList = {
    content = {sequence = 'Blocks'}
  },
  CodeBlock = {
    attr = 'Attr',
    text = 'string',
  },
  DefinitionList = {
    content = {sequence = 'DefinitionItem'},
  },
  Div = {
    attr = 'Attr',
    content = 'Blocks',
  },
  Figure = {
    attr = 'Attr',
    caption = 'Caption',
    content = 'Blocks',
  },
  Header = {
    attr = 'Attr',
    content = 'Inlines',
    level = 'integer',
  },
  HorizontalRule = {
    content = 'Inlines',
  },
  LineBlock = {
    content = {sequence = 'Inlines'},
  },
  OrderedList = {
    content = {sequence = 'Blocks'},
  },
  Para = {
    content = 'Inlines',
  },
  Plain = {
    content = 'Inlines',
  },
  RawBlock = {
    content = 'Inlines',
  },
  Table = {
    attr = 'Attr',
    caption = 'Caption',
    colspecs = {sequence = 'ColSpec'},
    bodies = {sequence = 'TableBody'},
    head = 'TableHead',
    foot = 'TableFoot',
  },
}

local function warn_conversion (expected, actual, shift, extrainfo)
  local dbginfo = debug.getinfo(5 + (shift or 0), 'Sln')
  local dbginfostr = 'no detailed debug info available'
  if dbginfo then
    dbginfostr = (dbginfo.name or '<no name>') .. ' in ' .. dbginfo.source
      .. ':' .. dbginfo.currentline
  end
  warn(actual .. ' instead of ' .. expected .. ': ' .. dbginfostr
       .. (extrainfo and '\n' .. extrainfo or ''))
end

local makeCaption = pandoc.Caption
if not makeCaption then
  makeCaption = function (long, short)
    return {
      long = long,
      short = short
    }
  end
end

local ensure_type
ensure_type = {
  Attr = function (obj)
    local pt = ptype(obj)
    return pt == 'Attr'
      and obj
      or pandoc.Attr(obj)
  end,

  Blocks = function (obj, shift, extrainfo)
    shift = shift or 0
    local pt = ptype(obj)
    if pt == 'Blocks' then
      return obj
    elseif pt == 'List' or pt == 'table' then
      warn_conversion('Blocks', pt, shift, tostring(obj))
      return setmetatable(obj, BlocksMT)
    elseif pt == 'Inline' then
      warn_conversion('Blocks', pt, shift, tostring(obj))
      return setmetatable({pandoc.Plain{obj}}, BlocksMT)
    elseif pt == 'Inlines' then
      warn_conversion('Blocks', pt, shift, tostring(obj))
      return setmetatable({pandoc.Plain(obj)}, BlocksMT)
    else
      warn_conversion('Blocks', pt, shift, tostring(obj))
      return pandoc.Blocks(obj)
    end
  end,

  Caption = function (obj, shift, extrainfo)
    local tp = ptype(obj)
    if tp == 'Caption' then
      return obj
    elseif tp == 'table' and obj.long then
      if pandoc.Caption then warn_conversion('Caption', tp) end
      local long = ensure_type['Blocks'](obj.long, shift + 1, extrainfo)
      local short
      if obj.short then
        short = ensure_type['Inlines'](obj.short, shift + 1, extrainfo)
      end
      return makeCaption(long, short)
    else
      if pandoc.Caption then warn_conversion('Caption', tp) end
      local blocks = ensure_type['Blocks'](obj, shift + 1, extrainfo)
      if pandoc.Caption then
        return pandoc.Caption(blocks)
      else
        for i = 1, #obj do
          obj[i] = nil
        end
        obj.long = blocks
        return obj
      end
    end
  end,

  DefinitionItem = function (obj, shift)
    shift = shift or 0
    obj[1] = ensure_type['Inlines'](obj[1], shift + 1)
    obj[2] = ensure_type[{ sequence = 'Blocks'}](obj[2], shift + 1)
    return obj
  end,

  Inlines = function (obj, shift, extrainfo)
    shift = shift or 0
    local pt = ptype(obj)
    if pt == 'Inlines' then
      return obj
    elseif pt == 'List' or pt == 'table' then
      warn_conversion('Inlines', pt, shift, extrainfo)
      return setmetatable(obj, InlinesMT)
    else
      warn_conversion('Inlines', pt, shift, extrainfo)
      return pandoc.Inlines(obj)
    end
  end,

  Meta = function (obj, shift)
    if ptype(obj) ~= 'Meta' then
      warn_conversion('Meta', ptype(obj), shift)
      return pandoc.Meta(obj)
    end

    local function all_of_type (tbl, typename)
      for _, value in ipairs(tbl) do
        if ptype(value) ~= typename then
          return false
        end
      end
      return true
    end

    local function ensure_meta(mv, depth, curfield)
      local tmv = ptype(mv)

      if pandoc.List{'Inlines', 'Blocks', 'string', 'boolean'}:includes(tmv) then
        return mv
      elseif tmv == 'Block' then
        warn_conversion('Blocks', tmv, depth, curfield)
        return pandoc.Blocks(mv)
      elseif tmv == 'Inline' then
        warn_conversion('Inlines', tmv, depth, curfield)
        return pandoc.Inlines(mv)
      elseif tmv == 'List' or (tmv == 'table' and #mv > 0) then
        if #mv == 0 then
          return mv
        elseif all_of_type(mv, 'Block') then
          return ensure_type['Blocks'](mv, depth, curfield)
        elseif all_of_type(mv, 'Inline') then
          return ensure_type['Inlines'](mv, depth, curfield)
        else
          return pandoc.List.map(
            mv, function(m) return ensure_meta(m, depth+1, curfield) end)
        end
      elseif tmv == 'table' or tmv == 'Meta' then
        for key, v in pairs(mv) do
          mv[key] = ensure_meta(v, depth + 1, key)
        end
        return mv
      elseif tmv == 'number' then
        warn_conversion('metavalue', tmv, depth, curfield)
        return tostring(mv)
      end

      warn_conversion('metavalue', tmv, depth, curfield)
      return nil
    end

    return ensure_meta(obj, shift or 1)
  end,

  TableBody = function (obj, shift)
    local pt = ptype(obj)
    if pt ~= 'table' then
      warn_conversion('table (TableBody)', pt, shift + 1)
    end
    return obj
  end,

  TableFoot = function (obj)
    local pt = ptype(obj)
    if pt ~= 'pandoc TableFoot' and pt ~= 'TableFoot' then
      error('Cannot auto-convert to TableFoot, got ' .. pt)
    end
    return obj
  end,

  TableHead = function (obj)
    local pt = ptype(obj)
    if pt ~= 'pandoc TableHead' and pt ~= 'TableHead' then
      error('Cannot auto-convert to TableHead, got ' .. pt)
    end
    return obj
  end,

  integer = function (obj)
    if type(obj) ~= 'number' or math.floor(obj) ~= obj then
      warn_conversion('integer', type(obj))
      return math.floor(tonumber(obj))
    end
    return obj
  end,

  string = function (obj)
    if type(obj) ~= 'string' then
      warn_conversion('string', type(obj))
      return tostring(obj)
    end
    return obj
  end,
}
local ensure_type_metatable = {
  __index = function (tbl, key)
    if type(key) == 'table' then
      if key.sequence then
        return function (obj)
          local pt = ptype(obj)
          if pt == 'table' or pt == 'List' then
            return pandoc.List.map(obj, tbl[key.sequence])
          end
        end
      end
    end
    return function (obj)
      warn_conversion(key, ptype(obj))
      return obj
    end
  end
}
setmetatable(ensure_type, ensure_type_metatable)

local CaptionMT = pandoc.Caption and debug.getmetatable(pandoc.Caption{})
local CellMT = debug.getmetatable(pandoc.Cell{})
local InlineMT = debug.getmetatable(pandoc.Space())
local BlockMT = debug.getmetatable(pandoc.HorizontalRule())
local PandocMT = debug.getmetatable(pandoc.Pandoc{})
local default_setter = PandocMT.setters.blocks

local function enable_attribute_checks()
  for fieldname, setter in pairs(InlineMT.setters) do
    InlineMT.setters[fieldname] = function (obj, key, value)
      local expected_type = InlineTypes[obj.tag][key]
      value = expected_type
        and ensure_type[expected_type](value, 0)
        or value
      setter(obj, key, value)
    end
  end
  for fieldname, setter in pairs(BlockMT.setters) do
    BlockMT.setters[fieldname] = function (obj, key, value)
      local expected_type = BlockTypes[obj.tag][fieldname]
      value = expected_type
        and ensure_type[expected_type](value, 0)
        or value
      setter(obj, key, value)
    end
  end

  -- Caption (currently only in pandoc dev version)
  if CaptionMT then
    CaptionMT.setters.short = function (obj, key, value)
      if value ~= nil then
        default_setter(obj, key, ensure_type['Inlines'](value))
      end
    end
    CaptionMT.setters.long = function (obj, key, value)
      default_setter(obj, key, ensure_type['Blocks'](value))
    end
  end

  -- Cell
  CellMT.setters.col_span = function (obj, key, value)
    default_setter(obj, key, ensure_type['integer'](value))
  end
  CellMT.setters.contents = function (obj, key, value)
    default_setter(obj, key, ensure_type['Blocks'](value))
  end

  -- Pandoc
  PandocMT.setters.meta = function (obj, key, value)
    default_setter(obj, key, ensure_type['Meta'](value))
  end
  PandocMT.setters.blocks = function (obj, key, value)
    default_setter(obj, key, ensure_type['Blocks'](value))
  end
end

return {
  ensure_type_verbose = ensure_type,

  enable_attribute_checks = enable_attribute_checks
}
