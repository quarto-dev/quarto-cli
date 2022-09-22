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

---@param newline boolean
---@param start integer
---@param leading string
---@param elType string
---@param elVar string
---@return { start: integer, finish: integer, prefix: string } | nil
local functionDiff = function(newline, start, leading, elType, elVar)
    
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
    -- handle variation between beginning of file and beginning of line
    local prefix = ''
    local finish = nil
    if newline then
      start = start - 1
      finish = start
      prefix = '\n'
    else
      finish = start - 1
    end
    -- provide the diff w/ requisite start and finish
    return {
      start = start,
      finish = finish,
      text = (prefix .. '%s---@param %s pandoc.%s\n%s---@return %s\n'):format(
        leading,elVar,elType,leading,returnType
      )
    }
  else
    return nil
  end
  
end

---@param uri string
---@param text string
function OnSetText(uri, text)

  -- manage list of diffs
  local diffs = {}
  local addDiff = function(diff)
    if diff then
      diffs[#diffs+1] = diff
    end
  end

  local patterns = {
    -- Div = function(el)
    '()([\t ]*)(%w+)%s*=%s*function%((%w+)%)',
    -- function Div(el)
    '()([\t ]*)function%s+(%w+)%((%w+)%)'  
  }

  for _, pattern in pairs(patterns) do
    -- patterns in file (after first line)
    for start, leading, elType, elVar in text:gmatch('\n' .. pattern) do
      addDiff(functionDiff(true, start --[[@as integer]], leading, elType, elVar))
    end
     -- pattern on first line
     local start, leading, elType, elVar = text:match('^' .. pattern)
     if start ~= nil then
       addDiff(functionDiff(false, start, leading, elType, elVar))
     end
  end

  return diffs     

end