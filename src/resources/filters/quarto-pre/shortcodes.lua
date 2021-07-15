-- shortcodes.lua
-- Copyright (C) 2020 by RStudio, PBC


-- The open and close shortcode indicators
local kOpenShortcode = "{{<"
local kOpenShortcodeEscape = "/*"
local kCloseShortcode = ">}}"
local kCloseShortcodeEscape = "*/"

function shortCodes() 
  return {

    Blocks = transformShortcodeBlocks,

    Inlines = transformShortcodeInlines,

    Code = transformShortcodeCode,

    CodeBlock =  transformShortcodeCode,

    Link = transformLink,

    Image = transformImage,
    
  }
end

-- transforms shortcodes in link targets
function transformLink(el)
  local target = urldecode(el.target)
  local tranformed = transformString(target);
  if tranformed ~= nil then
    el.target = tranformed
    return el
  end
end

-- transforms shortcodes in img srcs
function transformImage(el)
  local target = urldecode(el.src)
  local tranformed = transformString(target);
  if tranformed ~= nil then
    el.src = tranformed
    return el
  end
end

-- transforms shortcodes inside code
function transformShortcodeCode(el)

  -- don't process shortcodes in code output from engines
  -- (anything in an engine processed code block was actually
  --  proccessed by the engine, so should be printed as is)
  if el.attr.classes:includes("cell-code") then
    return
  end

  -- don't process shortcodes if they are explicitly turned off
  if el.attr.attributes["shortcodes"] == "false" then
    return
  end
  
  -- process shortcodes
  local text = el.text:gsub(kOpenShortcode .. "(.-)" .. kCloseShortcode, function(code)
    -- see if any of the shortcode handlers want it (and transform results to plain text)
    local inlines = markdownToInlines(kOpenShortcode .. code .. kCloseShortcode)
    local transformed = transformShortcodeInlines(inlines)
    if transformed ~= nil then
      return inlinesToString(transformed)
    else
      return code
    end
  end)

  -- return new element if the text changd
  if text ~= el.text then
    el.text = text
    return el
  end
end

-- finds blocks that only contain a shortcode and processes them
function transformShortcodeBlocks(blocks) 
  local transformed = false
  local scannedBlocks = pandoc.List:new()
  
  for i,block in ipairs(blocks) do 
    -- inspect para and plain blocks for shortcodes
    if block.t == "Para" or block.t == "Plain" then

      -- if contents are only a shortcode, process and return
      local onlyShortcode = onlyShortcode(block.content)
      if onlyShortcode ~= nil then
        -- there is a shortcode here, process it and return the blocks
          local shortCode = processShortCode(onlyShortcode)
          local handler = handlerForShortcode(shortCode, "block")
          if handler ~= nil then
            local transformedShortcode = handler.handle(shortCode)
            if transformedShortcode ~= nil then
              scannedBlocks:insert(transformedShortcode)
              transformed = true                  
            end
          else
            warn("Shortcode " .. shortCode.name .. " is not recognized.")
          end
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
  local outputInlines = pandoc.List:new()
  local shortcodeInlines = pandoc.List:new()
  local accum = outputInlines
  
  -- iterate through any inlines and process any shortcodes
  for i, el in ipairs(inlines) do

    if el.t == "Str" then 

      -- handle shortcode escape -- e.g. {{</* shortcode_name */>}}
      if endsWith(el.text, kOpenShortcode .. kOpenShortcodeEscape) then
        -- This is an escape, so insert the raw shortcode as text (remove the comment chars)
        transformed = true
        accum:insert(pandoc.Str(kOpenShortcode))
        

      elseif startsWith(el.text, kCloseShortcodeEscape .. kCloseShortcode) then 
        -- This is an escape, so insert the raw shortcode as text (remove the comment chars)
        transformed = true
        accum:insert(pandoc.Str(kCloseShortcode))

      elseif endsWith(el.text, kOpenShortcode) then
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
        transformed = true

        -- the end of the shortcode, stop accumulating the shortcode
        accum:insert(pandoc.Str(kCloseShortcode))
        accum = outputInlines

        -- process the shortcode
        local shortCode = processShortCode(shortcodeInlines)

        -- find the handler for this shortcode and transform
        local handler = handlerForShortcode(shortCode, "inline")
        if handler ~= nil then
          local expanded = handler.handle(shortCode)
          if expanded ~= nil then
            -- process recursively
            local expandedAgain = transformShortcodeInlines(expanded)
            if (expandedAgain ~= nil) then
              tappend(accum, expandedAgain)
            else
              tappend(accum, expanded)
            end
          end
        else
          tappend(accum, shortcodeInlines)
        end

        local suffix = el.text:sub(#kCloseShortcode + 1)
        if suffix then
          accum:insert(pandoc.Str(suffix))
        end   

        -- clear the accumulated shortcode inlines
        shortcodeInlines = pandoc.List:new()        
      else 
        -- not a shortcode, accumulate
        accum:insert(el)
      end
    else
      -- not a string, accumulate
      accum:insert(el)
    end
  end
  
  if transformed then
    return outputInlines
  else
    return nil
  end

end

-- transforms shorts in a string
function transformString(str)
  if string.find(str, kOpenShortcode) then
    local inlines = markdownToInlines(str)
    if inlines ~= nil then 
      local mutatedTarget = transformShortcodeInlines(inlines)
      if mutatedTarget ~= nil then
        return inlinesToString(mutatedTarget)
      end      
    end
  end  
  return nil
end

-- processes inlines into a shortcode data structure
function processShortCode(inlines) 

  local kSep = "="
  local shortCode = nil
  local args = pandoc.List:new()

  -- slice off the open and close tags
  inlines = tslice(inlines, 2, #inlines - 1)

  -- handling for names with accompanying values
  local pendingName = nil
  notePendingName = function(el)
    pendingName = el.text:sub(1, -2)
  end

  -- Adds an argument to the args list (either named or unnamed args)
  insertArg = function(argInlines) 
    if nextValueName ~= nil then
      -- there is a pending name, insert this arg
      -- with that name
      args:insert(
        {
          name = nextValueName,
          value = argInlines
        })
      pendingName = nil
    else
      -- split the string on equals
      if #argInlines == 1 and string.match(argInlines[1].text, kSep) then 
        -- if we can, split the string and assign name / value arg
        -- otherwise just put the whole thing in unnamed
        local parts = split(argInlines[1].text, kSep)
        if #parts == 2 then 
          args:insert(
              { 
                name = parts[1], 
                value = parts[2]
              })
        else
          args:insert(
            { 
              value = argInlines 
            })
        end
      else
        -- this is an unnamed argument
        args:insert(
          { 
            value = argInlines
          })
      end
    end
  end

  -- The core loop
  for i, el in ipairs(inlines) do
    if el.t == "Str" then
      if shortCode == nil then
        -- the first value is a pure text code name
        shortCode = el.text
      else
        -- if we've already captured the code name, proceed to gather args
        if endsWith(el.text, kSep) then 
          -- this is the name of an argument
          notePendingName(el)
        else
          -- this is either an unnamed arg or an arg value
          insertArg({el})
        end
      end
    elseif el.t == "Quoted" then 
      -- this is either an unnamed arg or an arg value
      insertArg(el.content)
    end
  end

  return {
    args = args,
    name = shortCode
  }
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

  local lastNonEmptyEl = nil
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


