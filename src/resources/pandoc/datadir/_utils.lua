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
    -- check if this is a custom AST node
    if v.t == "RawInline" and v.format == "QUARTO_custom" then
      local s, e = v.text:find("%a+$")
      return "Custom" .. v.text:sub(s, e)
    end
  end
  return pandoc_type
end

return {
  dump = dump,
  type = get_type,
  table = {
    isarray = tisarray,
    contains = tcontains
  },
}

