-- shortcodes.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

local shortcode_lpeg = require("lpegshortcode")

_quarto.ast.add_handler({
  class_name = { "quarto-shortcode__" },

  ast_name = "Shortcode",

  kind = "Inline",

  parse = function(span)
    local shortcode_content = span.content:map(function(el)
      if not el.classes:includes("quarto-shortcode__-param") then
        error("Unexpected span in a shortcode parse")
        quarto.log.output(el)
        crash_with_stack_trace()
      end

      -- is it a recursive shortcode?
      local custom_data, t, kind = _quarto.ast.resolve_custom_data(el)
      if custom_data ~= nil then
        return {
          type = "shortcode",
          value = custom_data
        }
      end

      -- is it a plain value?
      if el.attributes["data-raw"] then
        return {
          type = "param",
          value = el.attributes["data-raw"]
        }
      end

      -- it is a key value.
      if el.attributes["data-key"] then
        local key = el.attributes["data-key"]
        local value = el.attributes["data-value"]
        if value == nil then
          -- it's a recursive value
          value = el.content[1]
          return {
            type = "key-value-shortcode",
            key = key,
            value = value
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
        error("Unexpected span in a shortcode parse")
        quarto.log.output(el)
        crash_with_stack_trace()
      end
    end)
    local name = shortcode_content:remove(1)
    if name.type == "param" then
      name = name.value
    end
    return quarto.Shortcode({
      name = name,
      params = shortcode_content
    })
  end,

  render = function(node)
    print("Should not need to render a shortcode.")
    crash_with_stack_trace()
  end,

  constructor = function(tbl)
    return tbl
  end,

  inner_content = function(node)
    local result = {}
    if node.name.type == "shortcode" then
      result.name = node.name
    end
    for i, v in ipairs(node.params) do
      if v.type == "key-value-shortcode" then
        result[i] = v.value
      end
    end
    return result
  end,

  set_inner_content = function(node, new_content)
    if new_content.name ~= nil then
      node.name = new_content.name
    end
    for i, v in ipairs(node.params) do
      if new_content[i] ~= nil then
        node.params[i].value = new_content[i]
        if type(new_content[i]) == "string" then
          node.params[i].type = "key-value"
        else
          -- we should really validate here...
          node.params[i].type = "key-value-shortcode"
        end
      end
    end
  end
})

local function handle_shortcode(shortcode_tbl)
  local name
  if type(shortcode_tbl.name) ~= "string" then
    -- this is a recursive shortcode call
    name = handle_shortcode(shortcode_tbl.name)

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
      local result = handle_shortcode(v.value)
      table.insert(args, { value = result })
      table.insert(raw_args, result)
    elseif v.type == "param" then
      table.insert(args, { value = v.value })
      table.insert(raw_args, v.value)
    else
      error("Unexpected shortcode param type")
      quarto.log.output(v)
      crash_with_stack_trace()
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

local code_shortcode

local function ensure_shortcode_parser()
  if code_shortcode ~= nil then
    return code_shortcode
  end
  
end

function shortcodes_filter()
  local code_shortcode = shortcode_lpeg.make_shortcode_parser({
    escaped = function(s) return "{{<" .. s .. ">}}" end,
    string = function(s) return { value = s } end,
    keyvalue = function(k, v) return { name = k, value = s } end,
    shortcode = function(lst)
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
    end, 
  })
  
  local block_handler = function(node)
    local custom_data, t, kind = _quarto.ast.resolve_custom_data(node)
    if t ~= "Shortcode" then
      return nil
    end
    local result, struct = handle_shortcode(custom_data)
    return shortcodeResultAsBlocks(result, struct.name)
  end

  local inline_handler = function(custom_data)
    local result, struct = handle_shortcode(custom_data)
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
