-- Lua LSP Plugin to automatically recognize types for Pandoc Lua filter callbacks


local kBlockElements = {
  ['BlockQuote'] = true,
  ['BulletList'] = true,
  ['CodeBlock '] = true,
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

function OnSetText(uri, text)

  local diffs = {}
  for start, leading, elType, elVar in text:gmatch '\n()([\t ]*)(%w+)%s*=%s*function%((%w+)%)' do
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
        
    if returnType ~= nil then
      diffs[#diffs+1] = {
        start = start-1,
        finish = start-1,
        text = ('\n%s---@param %s pandoc.%s\n%s---@return %s\n'):format(
          leading,elVar,elType,leading,returnType
        )
      }
    end

  end

  return diffs     

end