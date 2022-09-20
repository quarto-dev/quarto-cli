-- Lua LSP Plugin to automatically recognize types for Pandoc Lua filter callbacks


local kBlockElements = {
  ['BlockQuote'] = true,
  ['BulletList'] = true,
  ['CodeBlock'] = true,
  ['DefinitionList'] = true,
  ['Div'] = true,
  ['Header'] = true,
  ['HorizontalRule'] = true,
  ['LineBlock'] = true,
  ['OrderedList'] = true,
  ['Para'] = true,
  ['Plain'] = true,
  ['RawBlock'] = true,
  ['Table'] = true
}
local kInlineElements = {
  ['Cite'] = true,
  ['Code'] = true,
  ['Emph'] = true,
  ['Image'] = true,
  ['LineBreak'] = true,
  ['Link'] = true,
  ['Math'] = true,
  ['Note'] = true,
  ['Quote'] = true,
  ['RawInline'] = true,
  ['SmallCaps'] = true,
  ['SoftBreak'] = true,
  ['Space'] = true,
  ['Span'] = true,
  ['Str'] = true,
  ['Strikeout'] = true,
  ['Strong'] = true,
  ['Superscript'] = true,
  ['Subscript'] = true,
  ['Underline'] = true
}

local kListElements = {
  ['Blocks'] = true,
  ['Inlines'] = true
}

local kTopLevelElements = {
  ['Meta'] = true,
  ['Pandoc'] = true
}

local functionDiff = function(start, leading, elType, elVar)
    
  -- determine return type and tweak elType
  local returnType = nil
  if kBlockElements[elType] ~= nil then
    returnType = 'pandoc.Block|pandoc.List|nil'
  elseif kInlineElements[elType] ~= nil then
    returnType = 'pandoc.Inline|pandoc.List|nil'
  elseif kListElements[elType] ~= nil then
    elType = 'List'
    returnType = 'pandoc.List|nil'
  elseif kTopLevelElements[elType] ~= nil then
    returnType = 'pandoc.' .. elType .. '|nil'
  end
       
  -- if this is one of ours then return it
  if returnType ~= nil then
    return {
      start = start-1,
      finish = start-1,
      text = ('\n%s---@param %s pandoc.%s\n%s---@return %s\n'):format(
        leading,elVar,elType,leading,returnType
      )
    }
  else
    return nil
  end
  
end

function OnSetText(uri, text)

  local diffs = {}

  -- functions of the form Div = function(el)
  for start, leading, elType, elVar in text:gmatch '\n()([\t ]*)(%w+)%s*=%s*function%((%w+)%)' do
    local diff = functionDiff(start, leading, elType, elVar)
    if diff then
      diffs[#diffs+1] = diff
    end
  end
  -- functions of the form function Div(el)
  for start, leading, elType, elVar in text:gmatch '\n()([\t ]*)function%s+(%w+)%((%w+)%)' do
    local diff = functionDiff(start, leading, elType, elVar)
    if diff then
      diffs[#diffs+1] = diff
    end
  end

  return diffs     

end