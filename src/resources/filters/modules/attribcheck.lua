local io     = require 'io'
local pandoc = require 'pandoc'
local utils  = require 'pandoc.utils'
local ptype  = utils.type

local InlinesMT = debug.getmetatable(pandoc.Inlines{})
local BlocksMT = debug.getmetatable(pandoc.Blocks{})

local function warn_conversion (expected, actual)
  -- local dbginfo = debug.getinfo(5, 'Sln')
  -- warn(actual .. ' instead of ' .. expected .. ': ' ..
  --      dbginfo.name .. ' in ' .. dbginfo.source .. ':' ..
  --      dbginfo.currentline)
  return
end

local function ensure_inlines(obj)
  local pt = ptype(obj)
  if pt == 'Inlines' then
    return obj
  elseif pt == 'List' or pt == 'table' then
    warn_conversion('Inlines', pt)
    return setmetatable(obj, InlinesMT)
  else
    warn_conversion('Inlines', pt)
    return pandoc.Inlines(obj)
  end
end

local function ensure_blocks(obj)
  local pt = ptype(obj)
  if pt == 'Blocks' then
    return obj
  elseif pt == 'List' or pt == 'table' then
    warn_conversion('Blocks', pt)
    return setmetatable(obj, BlocksMT)
  elseif pt == 'Inlines' then
    warn_conversion('Blocks', pt)
    return setmetatable({pandoc.Plain(obj)}, BlocksMT)
  else
    warn_conversion('Blocks', pt)
    return pandoc.Blocks(obj)
  end
end

local InlineMT = debug.getmetatable(pandoc.Space())
local BlockMT = debug.getmetatable(pandoc.HorizontalRule())
local default_setter = InlineMT.setters.content

local function enable_attribute_checks()
  InlineMT.setters.content = function (obj, key, value)
    if obj.tag == 'Note' then
      default_setter(obj, key, ensure_blocks(value))
    else
      default_setter(obj, key, ensure_inlines(value))
    end
  end
  BlockMT.setters.content = function (obj, key, value)
    local tag = obj.tag
    if tag == 'Para' or tag == 'Plain' or tag == 'Header' then
      default_setter(obj, key, ensure_inlines(value))
    elseif tag == 'Div' or tag == 'BlockQuote' or tag == 'Figure' then
      default_setter(obj, key, ensure_blocks(value))
    else
      default_setter(obj, key, value)
    end
  end
end

return {
  enable_attribute_checks = enable_attribute_checks
}
