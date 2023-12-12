-- _utils.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- improved formatting for dumping tables and quarto's emulated pandoc nodes
function tdump (tbl, raw)

  local shouldPrint = function(k, _, innerTbl)
    -- when raw, print everything
    if raw then
      return true
    end
    if type(k) == "number" then
      return true
    end
    if string.sub(k, 1, 1) == "-" then
      return false
    end
    return true
  end

  local refs = {}
  local resultTable = {}

  -- https://www.lua.org/pil/19.3.html
  local pairsByKeys = function (t, f)
    local a = {}
    for n in pairs(t) do table.insert(a, n) end
    table.sort(a, f)
    local i = 0      -- iterator variable
    local iter = function ()   -- iterator function
      i = i + 1
      if a[i] == nil then return nil
      else return a[i], t[a[i]]
      end
    end
    return iter
  end
  
  local printInner = function(str)
    table.insert(resultTable, str)
  end

  local empty = function(tbl)
    for k, v in pairs(tbl) do
      return false
    end
    return true
  end

  -- sigh.
  -- https://stackoverflow.com/questions/48209461/global-and-local-recursive-functions-in-lua
  local inner
  inner = function(tbl, indent, doNotIndentType)
    local address = string.format("%p", tbl)
    local indentStr = string.rep(" ", indent)
    local closeBracket = indentStr .. "}\n"
    if refs[address] ~= nil then
      printInner(indentStr .. "(circular reference to " .. address .. ")\n")
      return
    end
  
    local isArray = tisarray(tbl)
    local isEmpty = empty(tbl)
    
    if type(tbl) == "table" or type(tbl) == "userdata" and tbl.is_emulated then
      local typeIndent = indentStr
      if doNotIndentType then
        typeIndent = ""
      end
      local endOfOpen = "\n"
      if isEmpty then
        endOfOpen = " <empty> }\n"
      end

      if tbl.is_emulated then
        printInner(typeIndent .. string.format("{ [quarto-emulated-ast:%s:%s]%s", tbl.t, address, endOfOpen))
      elseif tisarray(tbl) then
        printInner(typeIndent .. string.format("{ [array:%s]%s", address, endOfOpen))
      else
        printInner(typeIndent .. string.format("{ [table:%s]%s", address, endOfOpen))
      end
      if raw then 
        printInner(indentStr .. " [metatable: " .. tostring(getmetatable(tbl)) .. "]\n")
      end
      if tbl.attr then
        printInner(indentStr .. "  attr: " .. tostring(tbl.attr) .. "\n")
      end
    end
    local empty = true
    local typesThenValues = function(a, b)
      local ta = type(a)
      local tb = type(b)
      if ta < tb then return true end
      if ta > tb then return false end
      return a < b
    end
    for k, v in pairsByKeys(tbl, typesThenValues) do
      if shouldPrint(k, v, tbl) then
        empty = false
        formatting = indentStr .. "  " .. k .. ": "
        v = asLua(v)
        if type(v) == "table" or type(v) == "userdata" and v.is_emulated then
          printInner(formatting)
          refs[address] = true
          local indentBump = 2
          if string.len(k) < 3 then -- this does work when k is number
            indentBump = string.len(k) + 1
          end
          inner(v, indent+indentBump, true)
        elseif type(v) == 'boolean' then
          printInner(formatting .. tostring(v) .. "\n")
        elseif (v ~= nil) then 
          printInner(formatting .. tostring(v) .. "\n")
        else 
          printInner(formatting .. 'nil\n')
        end
      end
    end
    printInner(closeBracket) 
  end

  inner(tbl, 0)
  print(table.concat(resultTable, ""))
end

function asLua(o)
  if type(o) ~= 'userdata' then
    return o
  end
  
  if rawequal(o, PANDOC_READER_OPTIONS) then
    return {
      abbreviations = o.abbreviations,
      columns = o.columns,
      default_image_extension = o.default_image_extension,
      extensions = o.extensions,
      indented_code_classes = o.indented_code_classes,
      standalone = o.standalone,
      strip_comments = o.strip_comments,
      tab_stop = o.tab_stop,
      track_changes = o.track_changes,
    }
  elseif rawequal(o, PANDOC_WRITER_OPTIONS) then
    return {
      cite_method = o.cite_method,
      columns = o.columns,
      dpi = o.dpi,
      email_obfuscation = o.email_obfuscation,
      epub_chapter_level = o.epub_chapter_level,
      epub_fonts = o.epub_fonts,
      epub_metadata = o.epub_metadata,
      epub_subdirectory = o.epub_subdirectory,
      extensions = o.extensions,
      highlight_style = o.highlight_style,
      html_math_method = o.html_math_method,
      html_q_tags = o.html_q_tags,
      identifier_prefix = o.identifier_prefix,
      incremental = o.incremental,
      listings = o.listings,
      number_offset = o.number_offset,
      number_sections = o.number_sections,
      prefer_ascii = o.prefer_ascii,
      reference_doc = o.reference_doc,
      reference_links = o.reference_links,
      reference_location = o.reference_location,
      section_divs = o.section_divs,
      setext_headers = o.setext_headers,
      slide_level = o.slide_level,
      tab_stop = o.tab_stop,
      table_of_contents = o.table_of_contents,
      template = o.template,
      toc_depth = o.toc_depth,
      top_level_division = o.top_level_division,
      variables = o.variables,
      wrap_text = o.wrap_text
    }
  end
  v = tostring(o)
  if string.find(v, "^pandoc CommonState") then
    return {
      input_files = o.input_files,
      output_file = o.output_file,
      log = o.log,
      request_headers = o.request_headers,
      resource_path = o.resource_path,
      source_url = o.source_url,
      user_data_dir = o.user_data_dir,
      trace = o.trace,
      verbosity = o.verbosity
    }
  elseif string.find(v, "^pandoc LogMessage") then
    return v
  end
  return o
end

-- dump an object to stdout
function dump(o, raw)

  o = asLua(o)
  if type(o) == 'table' or type(o) == 'userdata' and o.is_emulated then
    tdump(o, raw)
  else
    print(tostring(o) .. "\n")
  end
end


-- is the table a simple array?
-- see: https://web.archive.org/web/20140227143701/http://ericjmritz.name/2014/02/26/lua-is_array/
function tisarray(t)
  if type(t) ~= "table" then 
    return false 
  end
  local i = 0
  for _ in pairs(t) do
    i = i + 1
    if t[i] == nil then
      return false
    end
  end
  return true
end

-- does the table contain a value
local function tcontains(t, value)
  if t and type(t) == "table" and value then
    for _, v in ipairs(t) do
      if v == value then
        return true
      end
    end
    return false
  end
  return false
end

local function get_type(v)
  local pandoc_type = pandoc.utils.type(v)
  if pandoc_type == "Inline" then
    if v.t == "Span" and v.attributes.__quarto_custom == "true" then
      return "CustomInline"
    end
  elseif pandoc_type == "Block" then
    if v.t == "Div" and v.attributes.__quarto_custom == "true" then
      return "CustomBlock"
    end
  end
  return pandoc_type
end

local function as_inlines(v)
  if v == nil then
    return pandoc.Inlines({})
  end
  local t = pandoc.utils.type(v)
  if t == "Inlines" then
    return v
  elseif t == "Blocks" then
    return pandoc.utils.blocks_to_inlines(v)
  elseif t == "Inline" then
    return pandoc.Inlines({v})
  elseif t == "Block" then
    return pandoc.utils.blocks_to_inlines({v})
  end

  if type(v) == "table" then
    local result = pandoc.Inlines({})
    for i, v in ipairs(v) do
      tappend(result, as_inlines(v))
    end
    return result
  end

  -- luacov: disable
  fatal("as_inlines: invalid type " .. t)
  return pandoc.Inlines({})
  -- luacov: enable
end

local function as_blocks(v)
  if v == nil then
    return pandoc.Blocks({})
  end
  local t = pandoc.utils.type(v)
  if t == "Blocks" then
    return v
  elseif t == "Inlines" then
    return pandoc.Blocks({pandoc.Plain(v)})
  elseif t == "Block" then
    return pandoc.Blocks({v})
  elseif t == "Inline" then
    return pandoc.Blocks({pandoc.Plain(v)})
  end

  if type(v) == "table" then
    return pandoc.Blocks(v)
  end

  -- luacov: disable
  fatal("as_blocks: invalid type " .. t)
  return pandoc.Blocks({})
  -- luacov: enable
end

local function match_fun(reset, ...)
  local args = {...}
  return function(v)
    reset()
    for _, f in ipairs(args) do
      local r = f(v)
      if r == false or r == nil then
        return r
      end
      if r ~= true then
        v = r
      end
    end
    return v
  end
end


-- ## syntax examples
--
-- match("Div")
--   returns the node if it's a Div, otherwise false
-- match("Div/[1]")
--   returns the first child of a Div, otherwise false
-- match(".class")
--   returns the node if it has the class "class", otherwise false
-- match("#id")
--   returns the node if it has the id "id", otherwise false
--
-- match("Div/:child/Para") (in analogy to "div > p" in CSS)
--   returns the div if it has a direct child Para, otherwise false
--
-- match("Div/:descendant/Para") (in analogy to "div p" in CSS)
--   returns the div if it has a direct child Para, otherwise false
--
-- ## Node captures
-- 
-- match("{Div}/[1]/Para") (capture)
--   returns a list with the div if the first child is a Para, otherwise false
-- match("{Div}/[1]/{Para}/[1]/Img") (capture)
--   returns a list with the div and Para if the first child is a Para whose 
--   first child is an Image, otherwise false
--
-- ## custom matchers
--
-- match("Div", function(node) return node.content[1] end) 
--   is equivalent to match("Div/[1]")
-- match("Div", function(node) return node.content[1] end, "Para")
--   is equivalent to match("Div/[1]/Para")
--
--

-- Performance notes: :descendant is implemented with a walk, 
-- so it's not very efficient. 
--
-- eg :descendant/#id walks the node set
-- 
-- repeated calls to :descendant in the same match are likely 
-- to be quite slow

-- TODO we probably need to consider recursive reentrancy here
local function match(...)
  local result = {}
  local captured = false
  local captures = {}
  local capture_id = function(v) return v end
  local capture_add = function(v) 
    table.insert(captures, v) 
    return v 
  end
  local function reset()
    result = {}
    captures = {}
  end

  -- canonicalize the arguments into split_args
  local args = {...}
  local split_args = {}
  for _, v in ipairs(args) do
    if type(v) == "string" then
      local vs = split(v, "/", true)
      tappend(split_args, vs)
    else
      table.insert(split_args, v)
    end
  end

  local function process_nth_child(n, capture_fun)
    table.insert(result, function(node)
      if node == nil then
        return false
      end
      local pt = pandoc.utils.type(node)
      local content
      if pt == "Blocks" or pt == "Inlines" then
        content = node
      else
        content = node.content
      end
      return content ~= nil and 
        content[n] and 
        capture_fun(content[n])
    end)
  end

  local function report_inner_result(r)
    if r == nil or r == false or not captured then
      return r
    end
    -- a table result indicates the child was captured
    -- and we might need to return the parent
    -- if we're also capturing
    if type(r) == "table" then
      for _, v in ipairs(r) do
        table.insert(captures, v)
      end
    end    
    return captures
  end

  local function process_child(index)
    -- call match recursively, slicing the remaining args
    local conf = table.pack(table.unpack(split_args, index))
    local inner_match = match(table.unpack(split_args, index))
    table.insert(result, function(node)
      if node.content == nil then
        return nil
      end
      local r
      for _, v in ipairs(node.content) do
        r = inner_match(v)
        if r ~= nil and r ~= false then
          break
        end
      end

      return report_inner_result(r)
    end)
  end

  local function process_descendant(index)
    local inner_match = match(table.unpack(split_args, index))
    table.insert(result, function(node)
      local r
      local function inner_process(inner_node)
        if r ~= nil and r ~= false then
          -- we've already found a match, so we can stop
          return
        end

        r = inner_match(inner_node)
      end
      _quarto.ast.walk(node, {
        Inline = inner_process,
        Block = inner_process
      })
      return report_inner_result(r)
    end)
  end

  for i, v in ipairs(split_args) do
    if type(v) == "string" then
      local first = v:sub(1, 1)
      local last = v:sub(-1)
      local capture_fun = capture_id
      if first == "{" then -- capture
        v = v:sub(2, -2)
        if last ~= "}" then
          fail("invalid match token: " .. v .. "(in " .. str .. ")")
          return match_fun(reset, {})
        end
        first = v:sub(1, 1)
        capture_fun = capture_add
        captured = true
      end
      -- close over capture_fun in all cases
      if v == "" then
        -- empty case exists to support {} as a valid parameter,
        -- which is useful to capture the result of the previous match when it's a function
        table.insert(result, (function(capture_fun) 
          return function(node) 
            return capture_fun(node) 
          end
        end)(capture_fun))
      elseif v == ":child" then
        process_child(i + 1)
        break
      elseif v == ":descendant" then
        process_descendant(i + 1)
        break
      elseif first == "." then
        table.insert(result, (function(capture_fun, v)
          return function(node) 
            return node.classes ~= nil and tcontains(node.classes, v) and capture_fun(node) 
          end
        end)(capture_fun, v:sub(2)))
      elseif first == "#" then
        table.insert(result, (function(capture_fun, v)
          return function(node) 
            return node.identifier ~= nil and node.identifier == v and capture_fun(node) 
          end
        end)(capture_fun, v:sub(2)))
      elseif first == "[" then -- [1]
        local n = tonumber(v:sub(2, -2))
        process_nth_child(n, capture_fun)
      elseif first:upper() == first then -- Plain
        table.insert(result, (function(capture_fun, v)
          return function(node) 
            return (is_regular_node(node, v) or is_custom_node(node, v)) and capture_fun(node) 
          end
        end)(capture_fun, v))
      else
        fail("invalid match token: " .. v .. "(in " .. str .. ")")
        return match_fun(reset, {})
      end
    elseif type(v) == "number" then
      process_nth_child(v, capture_id)
    elseif type(v) == "function" then
      table.insert(result, v)
    else
      fail("invalid match parameter: " .. tostring(v))
      return match_fun(reset, {})
    end
  end

  if captured then
    local function send_capture(v)
      if v then 
        return captures
      end
      return v
    end
    table.insert(result, send_capture)
  end
  return match_fun(reset, table.unpack(result))
end

return {
  dump = dump,
  type = get_type,
  table = {
    isarray = tisarray,
    contains = tcontains
  },
  as_inlines = as_inlines,
  as_blocks = as_blocks,
  match = match,
  add_to_blocks = function(blocks, block)
    if pandoc.utils.type(blocks) ~= "Blocks" then
      fatal("add_to_blocks: invalid type " .. pandoc.utils.type(blocks))
    end
    if block == nil then
      return
    end
    local t = pandoc.utils.type(block)
    if t == "Blocks" or t == "Inlines" then
      blocks:extend(block)
    elseif t == "Block" then
      table.insert(blocks, block)
    else
      fatal("add_to_blocks: invalid type " .. t)
    end
  end,
}

