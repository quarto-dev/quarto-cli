-- _utils.lua
-- Copyright (C) 2020 by RStudio, PBC

-- improved formatting for dumping tables
function tdump (tbl, indent, refs)
  if not refs then refs = {} end
  if not indent then indent = 0 end
  local address = string.format("%p", tbl)
  if refs[address] ~= nil then
    print(string.rep("  ", indent) .. "(circular reference to " .. address .. ")")
    return
  end

  if type(tbl) == "userdata" then
    print(string.rep("  ", indent) .. tbl.t)
  end
  local empty = true
  for k, v in pairs(tbl) do
    empty = false
    formatting = string.rep("  ", indent) .. k .. ": "
    v = asLua(v)
    if type(v) == "table" then
      print(formatting .. "table: " .. address)
      refs[address] = true
      tdump(v, indent+1, refs)
    elseif type(v) == 'boolean' then
      print(formatting .. tostring(v))
    elseif (v ~= nil) then 
      print(formatting .. tostring(v))
    else 
      print(formatting .. 'nil')
    end
  end
  if empty then
    print(string.rep("  ", indent) .. "<empty table>")
  end
end

-- "asLua" knows about pandoc opaque objects and converts them to Lua
-- objects ahead of debug printing
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
local function dump(o)
  o = asLua(o)
  if type(o) == 'table' then
    tdump(o)
  else
    print(tostring(o) .. "\n")
  end
end

-- is the table a simple array?
-- see: https://web.archive.org/web/20140227143701/http://ericjmritz.name/2014/02/26/lua-is_array/
function tisarray(t)
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

return {
  dump = dump,
  table = {
    isarray = tisarray,
    contains = tcontains
  }
}

