-- shortcodes.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

local shortcode_lpeg = require("lpegshortcode")

_quarto.ast.add_handler({
  class_name = { "quarto-shortcode__" },

  ast_name = "Shortcode",

  kind = "Inline",

  parse = function(span)
    local inner_content = pandoc.List({})

    span.content = span.content:filter(function(el)
      return el.t == "Span"
    end)
    local shortcode_content = span.content:map(function(el)
      if not el.classes:includes("quarto-shortcode__-param") then
        quarto.log.output(el)
        fatal("Unexpected span in a shortcode parse")
      end

      -- is it a recursive shortcode?
      local custom_data, t, kind = _quarto.ast.resolve_custom_data(el)
      if custom_data ~= nil then
        local inner_index = #inner_content+1
        inner_content:insert(custom_data)
        return {
          type = "shortcode",
          value = inner_index
        }
      end

      -- is it a plain value?
      if el.attributes["data-key"] == nil and el.attributes["data-value"] then
        return {
          type = "param",
          value = el.attributes["data-value"]
        }
      end

      -- it is a key value.
      if el.attributes["data-key"] then
        local key = el.attributes["data-key"]
        local value = el.attributes["data-value"]
        if value == nil then
          -- it's a recursive value
          value = el.content[1]
          local inner_index = #inner_content+1
          inner_content:insert(value)
          return {
            type = "key-value-shortcode",
            key = key,
            value = inner_index
          }
        else
          -- it's a plain value
          return {
            type = "key-value",
            key = key,
            value = value
          }
        end
      else
        quarto.log.output(el)
        fatal("Unexpected span in a shortcode parse")
      end
    end)
    local name = shortcode_content:remove(1)
    if name.type == "param" then
      name = name.value
    end

    local node = _quarto.ast.create_custom_node_scaffold("Shortcode", "Inline")
    node.content = inner_content:map(function(el) 
      return pandoc.Span({el}) 
    end)
    local tbl = {
      __quarto_custom_node = node,
      name = name,
      params = shortcode_content
    }
    
    return quarto.Shortcode(tbl)
  end,

  render = function(node)
    fatal("Should not need to render a shortcode.")
  end,

  constructor = function(tbl)
    return tbl, false
  end,
})

local function handle_shortcode(shortcode_tbl, node)
  local name
  if type(shortcode_tbl.name) ~= "string" then
    -- this is a recursive shortcode call,
    -- name is a number that indexes into the node's content
    -- to get the shortcode node to call.

    -- typically, shortcodes are resolved in a typewise traversal
    -- which is bottom up, so we should be seeing resolved shortcode
    -- content here. But in unusual cases, we might be calling
    -- this function outside of a filter, in which case
    -- we need to handle this explicitly

    if type(shortcode_tbl.name) ~= "number" then
      quarto.log.output(shortcode_tbl.name)
      fatal("Unexpected shortcode name type " .. type(shortcode_tbl.name))
    end

    local shortcode_node = node.content[shortcode_tbl.name]
    -- are we already resolved?
    for i, v in ipairs(shortcode_node.content) do
      local custom_data, t, kind = _quarto.ast.resolve_custom_data(v)
      if custom_data ~= nil then
        if t ~= "Shortcode" then
          quarto.log.output(t)
          fatal("Unexpected shortcode content type " .. tostring(t))
        end
        -- we are not resolved, so resolve
        shortcode_node.content[i] = handle_shortcode(custom_data, v)
      end
    end

    name = pandoc.utils.stringify(shortcode_node)
    -- TODO check that this returns a string as it should
  else 
    name = shortcode_tbl.name
  end

  local args = {}
  local raw_args = {}

  for _, v in ipairs(shortcode_tbl.params) do
    if v.type == "key-value" then
      table.insert(args, { name = v.key, value = v.value })
      table.insert(raw_args, v.value)
    elseif v.type == "key-value-shortcode" then
      local result = handle_shortcode(v.value)
      table.insert(args, { name = v.key, value = result })
      table.insert(raw_args, result)
    elseif v.type == "shortcode" then
      local shortcode_node = node.content[v.value]
      local custom_data, t, kind = _quarto.ast.resolve_custom_data(shortcode_node)
      local result
      if custom_data == nil then
        result = pandoc.utils.stringify(shortcode_node)
      elseif t ~= "Shortcode" then
        quarto.log.output(custom_data)
        quarto.log.output(t)
        fatal("Unexpected shortcode content type " .. tostring(t))
      else
        local result = handle_shortcode(custom_data, shortcode_node)
        result = pandoc.utils.stringify(result)
      end
      table.insert(args, { value = result })
      table.insert(raw_args, result)
    elseif v.type == "param" then
      table.insert(args, { value = v.value })
      table.insert(raw_args, v.value)
    else
      quarto.log.output(v)
      fatal("Unexpected shortcode param type " .. tostring(v.type))
    end
  end

  local shortcode_struct = {
    args = args,
    raw_args = raw_args,
    name = name
  }

  local handler = handlerForShortcode(shortcode_struct)
  if handler == nil then
    return nil, shortcode_struct
  end

  return callShortcodeHandler(handler, shortcode_struct), shortcode_struct
end

function shortcodes_filter()

  local code_shortcode = shortcode_lpeg.make_shortcode_parser({
    escaped = function(s) return "{{<" .. s .. ">}}" end,
    string = function(s) return { value = s } end,
    keyvalue = function(r, k, v) 
      return { name = k, value = v } 
    end,
    shortcode = function(open, space, lst, close)
      local name = table.remove(lst, 1).value
      local raw_args = {}
      for _, v in ipairs(lst) do
        table.insert(raw_args, v.value)
      end
      local shortcode_struct = {
        args = lst,
        raw_args = raw_args,
        name = name
      }
      local handler = handlerForShortcode(shortcode_struct)
      if handler == nil then
        return ""
      end
      local result = callShortcodeHandler(handler, shortcode_struct)
      return pandoc.utils.stringify(result) 
    
      -- return "<<<" .. table.concat(lst, " ") .. ">>>"
    end, 
  })

  local block_handler = function(node)
    local custom_data, t, kind = _quarto.ast.resolve_custom_data(node)
    if t ~= "Shortcode" then
      return nil
    end
    local result, struct = handle_shortcode(custom_data, node)
    return shortcodeResultAsBlocks(result, struct.name)
  end

  local inline_handler = function(custom_data, node)
    local result, struct = handle_shortcode(custom_data, node)
    return shortcodeResultAsInlines(result, struct.name)
  end

  local code_handler = function(el)
    -- don't process shortcodes in code output from engines
    -- (anything in an engine processed code block was actually
    --  proccessed by the engine, so should be printed as is)
    if el.attr and el.attr.classes:includes("cell-code") then
      return
    end

    -- don't process shortcodes if they are explicitly turned off
    if el.attr and el.attr.attributes["shortcodes"] == "false" then
      return
    end

    el.text = code_shortcode:match(el.text)
    return el
  end

  local filter
  filter = {
    Pandoc = function(doc)
      -- first walk them in block context
      doc = _quarto.ast.walk(doc, {
        Para = block_handler,
        Plain = block_handler,
        Code = code_handler,
        RawBlock = code_handler,
        CodeBlock = code_handler,
      })

      doc = _quarto.ast.walk(doc, {
        Shortcode = inline_handler,
        RawInline = function(inline)
          if inline.format == "QUARTO_custom" then
            return nil
          end
          return code_handler(inline)
        end,
        Image = function(el)
          el.src = code_shortcode:match(el.src)
          return el
        end,
        Link = function(el)
          el.target = code_shortcode:match(el.target)
          return el
        end
       })
      return doc
    end
  }
  return filter
end

-- -- The open and close shortcode indicators
-- local kOpenShortcode = "{{<"
-- local kOpenShortcodeEscape = "/*"
-- local kCloseShortcode = ">}}"
-- local kCloseShortcodeEscape = "*/"
-- function shortCodesBlocks() 
--   return {
--     Blocks = transformShortcodeBlocks,
--     CodeBlock =  transformShortcodeCode,
--     RawBlock = transformShortcodeCode
--   }
-- end

-- function shortCodesInlines() 
--   return {
--     Inlines = transformShortcodeInlines,
--     Code = transformShortcodeCode,
--     RawInline = transformShortcodeCode,
--     Link = transformLink,
--     Image = transformImage
--   }
-- end

-- -- transforms shortcodes in link targets
-- function transformLink(el)
--   local target = urldecode(el.target)
--   local tranformed = transformString(target);
--   if tranformed ~= nil then
--     el.target = tranformed
--     return el
--   end
-- end

-- -- transforms shortcodes in img srcs
-- function transformImage(el)
--   local target = urldecode(el.src)
--   local tranformed = transformString(target);
--   if tranformed ~= nil then
--     el.src = tranformed
--     return el
--   end
-- end

-- -- transforms shortcodes inside code
-- function transformShortcodeCode(el)
--   -- don't process shortcodes in code output from engines
--   -- (anything in an engine processed code block was actually
--   --  proccessed by the engine, so should be printed as is)
--   if el.attr and el.attr.classes:includes("cell-code") then
--     return
--   end

--   -- don't process shortcodes if they are explicitly turned off
--   if el.attr and el.attr.attributes["shortcodes"] == "false" then
--     return
--   end
  
--   -- process shortcodes
--   local text = el.text:gsub("(%{%{%{*<)" ..  "(.-)" .. "(>%}%}%}*)", function(beginCode, code, endCode) 
--     if #beginCode > 3 or #endCode > 3 then
--       return beginCode:sub(2) .. code .. endCode:sub(1, #endCode-1)
--     else
--       -- see if any of the shortcode handlers want it (and transform results to plain text)
--       local inlines = markdownToInlines(kOpenShortcode .. code .. kCloseShortcode)
--       local transformed = transformShortcodeInlines(inlines, true)
--       if transformed ~= nil then
--         -- need to undo fancy quotes
--         local str = ''
--         for _,inline in ipairs(transformed) do
--           if inline.t == "Quoted" then
--             local quote = '"'
--             if inline.quotetype == "SingleQuote" then
--               quote = "'"
--             end
--             str = str .. quote .. inlinesToString(inline.content) .. quote
--           else
--             str = str .. pandoc.utils.stringify(inline)
--           end
--         end
--         return str
--       else
--         return beginCode .. code .. endCode
--       end
--     end
--   end)

--   -- return new element if the text changd
--   if text ~= el.text then
--     el.text = text
--     return el
--   end
-- end

-- -- finds blocks that only contain a shortcode and processes them
-- function transformShortcodeBlocks(blocks) 
--   local transformed = false
--   local scannedBlocks = pandoc.List()
  
--   for i,block in ipairs(blocks) do 
--     -- inspect para and plain blocks for shortcodes
--     if block.t == "Para" or block.t == "Plain" then

--       -- if contents are only a shortcode, process and return
--       local onlyShortcode = onlyShortcode(block.content)
--       if onlyShortcode ~= nil then
--         -- there is a shortcode here, process it and return the blocks
--         local shortCode = processShortCode(onlyShortcode)
--         local handler = handlerForShortcode(shortCode)
--         if handler ~= nil then
--           local transformedShortcode = callShortcodeHandler(handler, shortCode)
--           if transformedShortcode ~= nil then
--             tappend(scannedBlocks, shortcodeResultAsBlocks(transformedShortcode, shortCode.name))
--             transformed = true                  
--           end
--         else
--           scannedBlocks:insert(block)
--         end
--       else 
--         scannedBlocks:insert(block)
--       end
--     else
--       scannedBlocks:insert(block)
--     end
--   end
  
--   -- if we didn't transform any shortcodes, just return nil to signal
--   -- no changes
--   if transformed then
--     return scannedBlocks
--   else
--     return nil
--   end
-- end

-- helper function to read metadata options
local function readMetadata(value)
  -- We were previously coercing everything to lists of inlines when possible
  -- which made for some simpler treatment of values in meta, but it also
  -- meant that reading meta here was different than reading meta in filters
  -- 
  -- This is now just returning the raw meta value and not coercing it, so 
  -- users will have to be more thoughtful (or just use pandoc.utils.stringify)
  --
  -- Additionally, this used to return an empty list of inlines but now
  -- it returns nil for an unset value
  return option(value, nil)
end

-- call a handler w/ args & kwargs
function callShortcodeHandler(handler, shortCode)
  local args = pandoc.List()
  local kwargs = setmetatable({}, { __index = function () return pandoc.Inlines({}) end })
  for _,arg in ipairs(shortCode.args) do
    if arg.name then
      kwargs[arg.name] = arg.value
    else
      args:insert(arg.value)
    end
  end
  local meta = setmetatable({}, { __index = function(t, i) 
    return readMetadata(i)
  end})
  local callback = function()
    return handler.handle(args, kwargs, meta, shortCode.raw_args)
  end
  -- set the script file path, if present
  if handler.file ~= nil then
    return _quarto.withScriptFile(handler.file, callback)
  else
    return callback()
  end
end

-- -- scans through a list of inlines, finds shortcodes, and processes them
-- function transformShortcodeInlines(inlines, noRawInlines)
--   local transformed = false
--   local outputInlines = pandoc.List()
--   local shortcodeInlines = pandoc.List()
--   local accum = outputInlines

--   local function ensure_accum(i)
--     if not transformed then
--       transformed = true
--       for j = 1,i - 1 do
--         outputInlines:insert(inlines[j])
--       end
--     end
--   end
  
--   -- iterate through any inlines and process any shortcodes
--   for i, el in ipairs(inlines) do

--     if el.t == "Str" then 

--       -- find escaped shortcodes
--       local beginEscapeMatch = el.text:match("%{%{%{+<$")
--       local endEscapeMatch = el.text:match("^>%}%}%}+")

--       -- handle {{{< shortcode escape
--       if beginEscapeMatch then
--         ensure_accum(i)
--         local prefixLen = #el.text - #beginEscapeMatch
--         if prefixLen > 0 then
--           accum:insert(pandoc.Str(el.text:sub(1, prefixLen)))
--         end
--         accum:insert(pandoc.Str(beginEscapeMatch:sub(2)))
        
--       -- handle >}}} shortcode escape
--       elseif endEscapeMatch then
--         ensure_accum(i)
--         local suffixLen = #el.text - #endEscapeMatch
--         accum:insert(pandoc.Str(endEscapeMatch:sub(1, #endEscapeMatch-1)))
--         if suffixLen > 0 then
--           accum:insert(pandoc.Str(el.text:sub(#endEscapeMatch + 1)))
--         end

--       -- handle shortcode escape -- e.g. {{</* shortcode_name */>}}
--       elseif endsWith(el.text, kOpenShortcode .. kOpenShortcodeEscape) then
--         -- This is an escape, so insert the raw shortcode as text (remove the comment chars)
--         ensure_accum(i)
--         accum:insert(pandoc.Str(kOpenShortcode))
        

--       elseif startsWith(el.text, kCloseShortcodeEscape .. kCloseShortcode) then 
--         -- This is an escape, so insert the raw shortcode as text (remove the comment chars)
--         ensure_accum(i)
--         accum:insert(pandoc.Str(kCloseShortcode))

--       elseif endsWith(el.text, kOpenShortcode) then
--         ensure_accum(i)
--         -- note that the text might have other text with it (e.g. a case like)
--         -- This is my inline ({{< foo bar >}}).
--         -- Need to pare off prefix and suffix and preserve them
--         local prefix = el.text:sub(1, #el.text - #kOpenShortcode)
--         if prefix then
--           accum:insert(pandoc.Str(prefix))
--         end

--         -- the start of a shortcode, start accumulating the shortcode
--         accum = shortcodeInlines
--         accum:insert(pandoc.Str(kOpenShortcode))
--       elseif startsWith(el.text, kCloseShortcode) then

--         -- since we closed a shortcode, mark this transformed
--         ensure_accum(i)

--         -- the end of the shortcode, stop accumulating the shortcode
--         accum:insert(pandoc.Str(kCloseShortcode))
--         accum = outputInlines

--         -- process the shortcode
--         local shortCode = processShortCode(shortcodeInlines)

--         -- find the handler for this shortcode and transform
--         local handler = handlerForShortcode(shortCode)
--         if handler ~= nil then
--           local expanded = callShortcodeHandler(handler, shortCode)
--           if expanded ~= nil then
--             -- process recursively
--             expanded = shortcodeResultAsInlines(expanded, shortCode.name)
--             local expandedAgain = transformShortcodeInlines(expanded, noRawInlines)
--             if (expandedAgain ~= nil) then
--               tappend(accum, expandedAgain)
--             else
--               tappend(accum, expanded)
--             end
--           end
--         else
--           if noRawInlines then
--             tappend(accum, shortcodeInlines)
--           else
--             accum:insert(pandoc.RawInline("markdown", inlinesToString(shortcodeInlines)))
--           end
--         end

--         local suffix = el.text:sub(#kCloseShortcode + 1)
--         if suffix then
--           accum:insert(pandoc.Str(suffix))
--         end   

--         -- clear the accumulated shortcode inlines
--         shortcodeInlines = pandoc.List()        
--       else 
--         -- not a shortcode, accumulate
--         if transformed then
--           accum:insert(el)
--         end
--       end
--     else
--       -- not a string, accumulate
--       if transformed then
--         accum:insert(el)
--       end
--     end
--   end
  
--   if transformed then
--     return outputInlines
--   else
--     return nil
--   end

-- end

-- -- transforms shorts in a string
-- function transformString(str)
--   if string.find(str, kOpenShortcode) then
--     local inlines = markdownToInlines(str)
--     if inlines ~= nil and #inlines > 0 then 
--       local mutatedTarget = transformShortcodeInlines(inlines)
--       if mutatedTarget ~= nil then
--         return inlinesToString(mutatedTarget)
--       end      
--     end
--   end  
--   return nil
-- end

-- -- processes inlines into a shortcode data structure
-- function processShortCode(inlines) 

--   local kSep = "="
--   local shortCode = nil
--   local args = pandoc.List()
--   local raw_args = pandoc.List()

--   -- slice off the open and close tags
--   inlines = tslice(inlines, 2, #inlines - 1)

--   -- handling for names with accompanying values
--   local pendingName = nil
--   notePendingName = function(el)
--     pendingName = el.text:sub(1, -2)
--   end

--   -- Adds an argument to the args list (either named or unnamed args)
--   insertArg = function(argInlines) 
--     if pendingName ~= nil then
--       -- there is a pending name, insert this arg
--       -- with that name
--       args:insert(
--         {
--           name = pendingName,
--           value = argInlines
--         })
--       pendingName = nil
--       raw_args:insert(argInlines)
--     else
--       -- split the string on equals
--       if #argInlines == 1 and argInlines[1].t == "Str" and string.match(argInlines[1].text, kSep) then 
--         -- if we can, split the string and assign name / value arg
--         -- otherwise just put the whole thing in unnamed
--         local parts = split(argInlines[1].text, kSep)
--         if #parts == 2 then 
--           args:insert(
--               { 
--                 name = parts[1], 
--                 value = stringToInlines(parts[2])
--               })
--         else
--           args:insert(
--             { 
--               value = argInlines 
--             })
--         end
--         raw_args:insert(argInlines)
--       -- a standalone SoftBreak or LineBreak is not an argument!
--       -- (happens when users delimit args with newlines)
--       elseif #argInlines > 1 or 
--              (argInlines[1].t ~= "SoftBreak" and argInlines[1].t ~= "LineBreak") then
--         -- this is an unnamed argument
--         args:insert(
--           { 
--             value = argInlines
--           })
--         raw_args:insert(argInlines)
--       end
--     end
--   end

--   -- The core loop
--   for i, el in ipairs(inlines) do
--     if el.t == "Str" then
--       if shortCode == nil then
--         -- the first value is a pure text code name
--         shortCode = el.text
--       else
--         -- if we've already captured the code name, proceed to gather args
--         if endsWith(el.text, kSep) then 
--           -- this is the name of an argument
--           notePendingName(el)
--         else
--           -- this is either an unnamed arg or an arg value
--           insertArg({el})
--         end
--       end
--     elseif el.t == "Quoted" then 
--       -- this is either an unnamed arg or an arg value
--       insertArg(el.content)
--     elseif el.t ~= "Space" then
--       insertArg({el})
--     end
--   end

--   return {
--     args = args,
--     raw_args = raw_args,
--     name = shortCode
--   }
-- end

-- function onlyShortcode(contents)
  
--   -- trim leading and trailing empty strings
--   contents = trimEmpty(contents)

--   if #contents < 1 then
--     return nil
--   end

--   -- starts with a shortcode
--   local startsWithShortcode = contents[1].t == "Str" and contents[1].text == kOpenShortcode
--   if not startsWithShortcode then
--     return nil
--   end

--   -- ends with a shortcode
--   local endsWithShortcode = contents[#contents].t == "Str" and contents[#contents].text == kCloseShortcode
--   if not endsWithShortcode then  
--     return nil
--   end

--   -- has only one open shortcode
--   local openShortcodes = filter(contents, function(el) 
--     return el.t == "Str" and el.text == kOpenShortcode  
--   end)
--   if #openShortcodes ~= 1 then
--     return nil
--   end

--   -- has only one close shortcode 
--   local closeShortcodes = filter(contents, function(el) 
--     return el.t == "Str" and el.text == kCloseShortcode  
--   end) 
--   if #closeShortcodes ~= 1 then
--     return nil
--   end
    
--   return contents
-- end

-- function trimEmpty(contents) 
--   local firstNonEmpty = 1
--   for i, el in ipairs(contents) do
--     if el.t == "Str" and el.text == "" then
--       firstNonEmpty = firstNonEmpty + 1
--     else
--       break
--     end
--   end
--   if firstNonEmpty > 1 then
--     contents = tslice(contents, firstNonEmpty, #contents)
--   end

--   local lastNonEmptyEl = nil
--   for i = #contents, 1, -1 do
--     el = contents[i]
--     if el.t == "Str" and el.text == "" then
--       contents = tslice(contents, 1, #contents - 1)
--     else
--       break
--     end
--   end
--   return contents
-- end


function shortcodeResultAsInlines(result, name)
  if result == nil then
    warn("Shortcode '" .. name .. "' not found")
    return {}
  end
  local type = quarto.utils.type(result)
  if type == "CustomBlock" then
    error("Custom AST Block returned from shortcode, but Inline was expected")
    os.exit(1)
  elseif type == "CustomInline" then
    return pandoc.Inlines( { result })
  elseif type == "Inlines" then
    return result
  elseif type == "Blocks" then
    return pandoc.utils.blocks_to_inlines(result, { pandoc.Space() })
  elseif type == "string" then
    return pandoc.Inlines( { pandoc.Str(result) })
  elseif tisarray(result) then
    local items = pandoc.List(result)
    local inlines = items:filter(isInlineEl)
    if #inlines > 0 then
      return pandoc.Inlines(inlines)
    else
      local blocks = items:filter(isBlockEl)
      return pandoc.utils.blocks_to_inlines(blocks, { pandoc.Space() })
    end
  elseif isInlineEl(result) then
    return pandoc.Inlines( { result })
  elseif isBlockEl(result) then
    return pandoc.utils.blocks_to_inlines( { result }, { pandoc.Space() })
  else
    error("Unexepected result from shortcode " .. name .. "")
    quarto.log.output(result)
    os.exit(1)
  end
end
  
function shortcodeResultAsBlocks(result, name)
  if result == nil then
    warn("Shortcode '" .. name .. "' not found")
    return {}
  end
  local type = quarto.utils.type(result)
  if type == "CustomBlock" or type == "CustomInline" then
    return pandoc.Blocks({pandoc.Plain(result)})
  elseif type == "Blocks" then
    return result
  elseif type == "Inlines" then
    return pandoc.Blocks( {pandoc.Para(result) }) -- why not a plain?
  elseif type == "string" then
    return pandoc.Blocks( {pandoc.Para({pandoc.Str(result)})} ) -- why not a plain?
  elseif tisarray(result) then
    local items = pandoc.List(result)
    local blocks = items:filter(isBlockEl)
    if #blocks > 0 then
      return pandoc.Blocks(blocks)
    else
      local inlines = items:filter(isInlineEl)
      return pandoc.Blocks({pandoc.Para(inlines)}) -- why not a plain?
    end
  elseif isBlockEl(result) then
    return pandoc.Blocks( { result } )
  elseif isInlineEl(result) then
    return pandoc.Blocks( {pandoc.Para( {result} ) }) -- why not a plain?
  else
    error("Unexepected result from shortcode " .. name .. "")
    quarto.log.output(result)
    os.exit(1)
  end
end
