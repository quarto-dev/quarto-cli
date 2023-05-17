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
        RawInline = code_handler,
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

function shortcodeResultAsInlines(result, name)
  if result == nil then
    warn("Shortcode '" .. name .. "' not found")
    return {}
  end
  local type = quarto.utils.type(result)
  if type == "Inlines" then
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
    error("Unexpected result from shortcode " .. name .. "")
    quarto.log.output(result)
    fatal("This is a bug in the shortcode. If this is a quarto shortcode, please report it at https://github.com/quarto-dev/quarto-cli")
  end
end
  
function shortcodeResultAsBlocks(result, name)
  if result == nil then
    warn("Shortcode '" .. name .. "' not found")
    return {}
  end
  local type = quarto.utils.type(result)
  if type == "Blocks" then
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
    error("Unexpected result from shortcode " .. name .. "")
    quarto.log.output(result)
    fatal("This is a bug in the shortcode. If this is a quarto shortcode, please report it at https://github.com/quarto-dev/quarto-cli")
  end
end
