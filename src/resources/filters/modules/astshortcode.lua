-- astshortcode.lua
-- Copyright (C) 2023 Posit Software, PBC

-- The open and close shortcode indicators
local kSep = "="
local kOpenShortcode = "{{<"
local kOpenShortcodeEscape = "/*"
local kCloseShortcode = ">}}"
local kCloseShortcodeEscape = "*/"

-- finds blocks that only contain a shortcode and processes them
local function transformShortcodeBlocks(blocks) 
  local transformed = false
  local scannedBlocks = pandoc.List()
  
  for i, block in ipairs(blocks) do 
    -- inspect para and plain blocks for shortcodes
    if block.t == "Para" or block.t == "Plain" then
      -- if contents are only a shortcode, process and return
      local onlyShortcode = onlyShortcode(block.content)
      if onlyShortcode ~= nil then
        -- there is a shortcode here, process it and return the representing span
        scannedBlocks:insert(processShortCode(onlyShortcode))
        transformed = true
      else 
        scannedBlocks:insert(block)
      end
    else
      scannedBlocks:insert(block)
    end
  end
  
  -- if we didn't transform any shortcodes, just return nil to signal
  -- no changes
  if transformed then
    return scannedBlocks
  else
    return nil
  end
end

-- scans through a list of inlines, finds shortcodes, and processes them
function transformShortcodeInlines(inlines)
  local transformed = false
  local outputInlines = pandoc.List()
  local shortcodeInlines = pandoc.List()
  local accum = outputInlines

  local function ensure_accum(i)
    if not transformed then
      transformed = true
      for j = 1,i - 1 do
        outputInlines:insert(inlines[j])
      end
    end
  end
  
  -- iterate through any inlines and process any shortcodes
  for i, el in ipairs(inlines) do

    if el.t == "Str" then 

      -- find escaped shortcodes
      local beginEscapeMatch = el.text:match("%{%{%{+<$")
      local endEscapeMatch = el.text:match("^>%}%}%}+")

      -- handle {{{< shortcode escape
      if beginEscapeMatch then
        ensure_accum(i)
        local prefixLen = #el.text - #beginEscapeMatch
        if prefixLen > 0 then
          accum:insert(pandoc.Str(el.text:sub(1, prefixLen)))
        end
        accum:insert(pandoc.Str(beginEscapeMatch:sub(2)))
        
      -- handle >}}} shortcode escape
      elseif endEscapeMatch then
        ensure_accum(i)
        local suffixLen = #el.text - #endEscapeMatch
        accum:insert(pandoc.Str(endEscapeMatch:sub(1, #endEscapeMatch-1)))
        if suffixLen > 0 then
          accum:insert(pandoc.Str(el.text:sub(#endEscapeMatch + 1)))
        end

      -- handle shortcode escape -- e.g. {{</* shortcode_name */>}}
      elseif endsWith(el.text, kOpenShortcode .. kOpenShortcodeEscape) then
        -- This is an escape, so insert the raw shortcode as text (remove the comment chars)
        ensure_accum(i)
        accum:insert(pandoc.Str(kOpenShortcode))
        

      elseif startsWith(el.text, kCloseShortcodeEscape .. kCloseShortcode) then 
        -- This is an escape, so insert the raw shortcode as text (remove the comment chars)
        ensure_accum(i)
        accum:insert(pandoc.Str(kCloseShortcode))

      elseif endsWith(el.text, kOpenShortcode) then
        ensure_accum(i)
        -- note that the text might have other text with it (e.g. a case like)
        -- This is my inline ({{< foo bar >}}).
        -- Need to pare off prefix and suffix and preserve them
        local prefix = el.text:sub(1, #el.text - #kOpenShortcode)
        if prefix then
          accum:insert(pandoc.Str(prefix))
        end

        -- the start of a shortcode, start accumulating the shortcode
        accum = shortcodeInlines
        accum:insert(pandoc.Str(kOpenShortcode))
      elseif startsWith(el.text, kCloseShortcode) then

        -- since we closed a shortcode, mark this transformed
        ensure_accum(i)

        -- the end of the shortcode, stop accumulating the shortcode
        accum:insert(pandoc.Str(kCloseShortcode))
        accum = outputInlines

        -- process the shortcode
        local shortCode = processShortCode(shortcodeInlines)
        accum:insert(shortCode)

        local suffix = el.text:sub(#kCloseShortcode + 1)
        if suffix then
          accum:insert(pandoc.Str(suffix))
        end   

        -- clear the accumulated shortcode inlines
        shortcodeInlines = pandoc.List()        
      else 
        -- not a shortcode, accumulate
        if transformed then
          accum:insert(el)
        end
      end
    else
      -- not a string, accumulate
      if transformed then
        accum:insert(el)
      end
    end
  end
  
  if transformed then
    return outputInlines
  else
    return nil
  end

end

-- processes inlines into a shortcode span
function processShortCode(inlines)
  local quarto_shortcode_class_prefix = "quarto-shortcode__"

  local function string_param(s)
    local result = pandoc.Span({})
    result.classes:insert(quarto_shortcode_class_prefix .. "-param")
    result.attributes["data-value"] = s
    return result
  end

  local function keyvalue_param(k, v)
    local result = pandoc.Span({})
    result.classes:insert(quarto_shortcode_class_prefix .. "-param")
    if type(k) == "string" then
      result.attributes["data-key"] = k
    else
      result.content:insert(k)
    end
    if type(v) == "string" then
      result.attributes["data-value"] = v
    else
      result.content:insert(v)
    end
    return result
  end

  -- return pandoc.Span({})

  local result = pandoc.Span({})
  result.classes:insert(quarto_shortcode_class_prefix)
  local key_name = nil

  -- slice off the open and close tags
  inlines = tslice(inlines, 2, #inlines - 1)

  local function insertArg(str)
    if key_name then
      result.content:insert(keyvalue_param(key_name, str))
      key_name = nil
    else
      result.content:insert(string_param(str))
    end
  end

  -- -- The core loop
  for i, el in ipairs(inlines) do
    if el.t == "Str" then
      if endsWith(el.text, kSep) then 
        -- this is the name of an argument
        key_name = el.text:sub(1, #el.text - #kSep)
      else
        -- this is either an unnamed arg or an arg value
        insertArg(el.text)
      end
    elseif el.t == "Quoted" then 
      -- this is either an unnamed arg or an arg value
      insertArg(pandoc.utils.stringify(el.content))
    elseif el.t ~= "Space" then
      error("Don't know what to do with " .. el.t .. " in shortcode; skipping")
      -- insertArg({el})
    end
  end

  return result
end

function onlyShortcode(contents)
  
  -- trim leading and trailing empty strings
  contents = trimEmpty(contents)

  if #contents < 1 then
    return nil
  end

  -- starts with a shortcode
  local startsWithShortcode = contents[1].t == "Str" and contents[1].text == kOpenShortcode
  if not startsWithShortcode then
    return nil
  end

  -- ends with a shortcode
  local endsWithShortcode = contents[#contents].t == "Str" and contents[#contents].text == kCloseShortcode
  if not endsWithShortcode then  
    return nil
  end

  -- has only one open shortcode
  local openShortcodes = filter(contents, function(el) 
    return el.t == "Str" and el.text == kOpenShortcode  
  end)
  if #openShortcodes ~= 1 then
    return nil
  end

  -- has only one close shortcode 
  local closeShortcodes = filter(contents, function(el) 
    return el.t == "Str" and el.text == kCloseShortcode  
  end) 
  if #closeShortcodes ~= 1 then
    return nil
  end
    
  return contents
end

function trimEmpty(contents) 
  local firstNonEmpty = 1
  for i, el in ipairs(contents) do
    if el.t == "Str" and el.text == "" then
      firstNonEmpty = firstNonEmpty + 1
    else
      break
    end
  end
  if firstNonEmpty > 1 then
    contents = tslice(contents, firstNonEmpty, #contents)
  end

  for i = #contents, 1, -1 do
    el = contents[i]
    if el.t == "Str" and el.text == "" then
      contents = tslice(contents, 1, #contents - 1)
    else
      break
    end
  end
  return contents
end

local function parse(meta)
  local doc = pandoc.Pandoc({}, meta)
  return _quarto.ast.walk(doc, {
    Blocks = transformShortcodeBlocks,
    Inlines = transformShortcodeInlines,   
  }).meta
end

return {
  parse = parse
}