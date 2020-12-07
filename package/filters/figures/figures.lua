-- debug.lua
-- Copyright (C) 2020 by RStudio, PBC

-- dump an object to stdout
function dump(o)
  if type(o) == 'table' then
    tdump(o)
  else
    print(tostring(o) .. "\n")
  end
end

-- improved formatting for dumping tables
function tdump (tbl, indent)
  if not indent then indent = 0 end
  for k, v in pairs(tbl) do
    formatting = string.rep("  ", indent) .. k .. ": "
    if type(v) == "table" then
      print(formatting)
      tdump(v, indent+1)
    elseif type(v) == 'boolean' then
      print(formatting .. tostring(v))
    else
      print(formatting .. v)
    end
  end
end



-- table.lua
-- Copyright (C) 2020 by RStudio, PBC

-- append values to table
function tappend(t, values)
  for i,value in pairs(values) do
    table.insert(t, value)
  end
end

-- prepend values to table
function tprepend(t, values)
  for i=1, #values do
   table.insert(t, 1, values[#values + 1 - i])
  end
end

-- slice elements out of a table
function tslice(t, first, last, step)
  local sliced = {}
  for i = first or 1, last or #t, step or 1 do
    sliced[#sliced+1] = t[i]
  end
  return sliced
end

-- does the table contain a value
function tcontains(t,value)
  if t and type(t)=="table" and value then
    for _, v in ipairs (t) do
      if v == value then
        return true
      end
    end
    return false
  end
  return false
end

-- clear a table
function tclear(t)
  for k,v in pairs(t) do
    t[k] = nil
  end
end

-- get keys from table
function tkeys(t)
  local keyset={}
  local n=0
  for k,v in pairs(t) do
    n=n+1
    keyset[n]=k
  end
  return keyset
end

-- sorted pairs. order function takes (t, a,)
function spairs(t, order)
  -- collect the keys
  local keys = {}
  for k in pairs(t) do keys[#keys+1] = k end

  -- if order function given, sort by it by passing the table and keys a, b,
  -- otherwise just sort the keys
  if order then
      table.sort(keys, function(a,b) return order(t, a, b) end)
  else
      table.sort(keys)
  end

  -- return the iterator function
  local i = 0
  return function()
      i = i + 1
      if keys[i] then
          return keys[i], t[keys[i]]
      end
  end
end

-- meta.lua
-- Copyright (C) 2020 by RStudio, PBC

-- constants
local kHeaderIncludes = "header-includes"

-- ensure that header-includes is a MetaList
function ensureHeaderIncludes(doc)
  if not doc.meta[kHeaderIncludes] then
    doc.meta[kHeaderIncludes] = pandoc.MetaList({})
  elseif doc.meta[kHeaderIncludes].t == "MetaInlines" then
    doc.meta[kHeaderIncludes] = pandoc.MetaList({doc.meta[kHeaderIncludes]})
  end
end

-- add a header include as a raw block
function addHeaderInclude(doc, format, include)
  doc.meta[kHeaderIncludes]:insert(pandoc.MetaBlocks(pandoc.RawBlock(format, include)))
end

-- conditionally include a package
function usePackage(pkg)
  return "\\@ifpackageloaded{" .. pkg .. "}{}{\\usepackage{" .. pkg .. "}}"
end


function metaInjectLatex(doc, func)
  if isLatexOutput() then
    ensureHeaderIncludes(doc)
    function inject(tex)
      addHeaderInclude(doc, "tex", tex)
    end
    inject("\\makeatletter")
    func(inject)
    inject("\\makeatother")
  end
end

function metaInjectHtml(doc, func)
  if isHtmlOutput() then
    ensureHeaderIncludes(doc)
    function inject(html)
      addHeaderInclude(doc, "html", html)
    end
    func(inject)
  end
end

-- figures.lua
-- Copyright (C) 2020 by RStudio, PBC

-- filter which tags subfigures with their parent identifier and also 
-- converts linked image figures into figure divs. we do this in a separate 
-- pass b/c normal filters go depth first so we can't actually
-- "see" our parent figure during filtering.
function preprocessFigures(captionRequired)

  return {
    Pandoc = function(doc)
      local walkFigures
      walkFigures = function(parentId)
        
        return {
          Div = function(el)
            if isFigureDiv(el, captionRequired) then
            
              if parentId ~= nil then
                el.attr.attributes["figure-parent"] = parentId
              else
                el = pandoc.walk_block(el, walkFigures(el.attr.identifier))
              end
              
              -- provide default caption if need be
              if figureDivCaption(el) == nil then
                el.content:insert(pandoc.Para({}))
              end
            end
            return el
          end,

          Para = function(el)
            return preprocessParaFigure(el, parentId, captionRequired)
          end
        }
      end

      -- walk all blocks in the document
      for i,el in pairs(doc.blocks) do
        local parentId = nil
        if isFigureDiv(el, captionRequired) then
          parentId = el.attr.identifier
          -- provide default caption if need be
          if figureDivCaption(el) == nil then
            el.content:insert(pandoc.Para({}))
          end
        end
        if el.t == "Para" then
          doc.blocks[i] = preprocessParaFigure(el, nil, captionRequired)
        else
          doc.blocks[i] = pandoc.walk_block(el, walkFigures(parentId))
        end
      end
      
      return doc

    end
  }
end

function preprocessParaFigure(el, parentId, captionRequired)
  
  -- if this is a figure paragraph, tag the image inside with any
  -- parent id we have
  local image = figureFromPara(el, captionRequired)
  if image and isFigureImage(image, captionRequired) then
    image.attr.attributes["figure-parent"] = parentId
    if #image.caption == 0 and not captionRequired then
      return createFigureDiv(el, image, parentId)
    else
      return el
    end
  end
  
  -- if this is a linked figure paragraph, transform to figure-div
  -- and then transfer attributes to the figure-div as appropriate
  local linkedFig = linkedFigureFromPara(el, captionRequired)
  if linkedFig and isFigureImage(linkedFig, captionRequired) then
    
    -- create figure div
    return createFigureDiv(el, linkedFig, parentId)
    
  end
  
  -- always reflect back input if we didn't hit one of our cases
  return el
  
end

function createFigureDiv(el, linkedFig, parentId)
  -- create figure-div and transfer caption
  local figureDiv = pandoc.Div(pandoc.Para(el.content))
  local caption = linkedFig.caption:clone()
  figureDiv.content:insert(pandoc.Para(caption))
  linkedFig.caption = {}
  
  -- if we have a parent, then transfer all attributes (as it's a subfigure)
  if parentId ~= nil then
    figureDiv.attr = linkedFig.attr:clone()
    linkedFig.attr = pandoc.Attr()
    figureDiv.attr.attributes["figure-parent"] = parentId
  -- otherwise just transfer id and any fig- prefixed attribs
  else
    figureDiv.attr.identifier = linkedFig.attr.identifier
    linkedFig.attr.identifier = ""
    for k,v in pairs(linkedFig.attr.attributes) do
      if string.find(k, "^fig%-") then
        figureDiv.attr.attributes[k] = v
        linkedFig.attr.attributes[k] = nil
      end
    end
  end
  
  -- return the div
  return figureDiv
  
end

-- is this element a subfigure
function isSubfigure(el)
  if el.attr.attributes["figure-parent"] then
    return true
  else
    return false
  end
end

-- is this a Div containing a figure
function isFigureDiv(el, captionRequired)
  if captionRequired == nil then
    captionRequired = true
  end
  if el.t == "Div" and hasFigureLabel(el) then
    return not captionRequired or figureDivCaption(el) ~= nil
  else
    return false
  end
end

-- is this an image containing a figure
function isFigureImage(el, captionRequired)
  if captionRequired == nil then
    captionRequired = true
  end
  if hasFigureLabel(el) then
    return not captionRequired or #el.caption > 0
  else
    return false
  end
end

-- does this element have a figure label?
function hasFigureLabel(el)
  return string.match(el.attr.identifier, "^fig:")
end

function figureDivCaption(el)
  local last = el.content[#el.content]
  if last and last.t == "Para" and #el.content > 1 then
    if not (#last.content == 1 and last.content[1].t == "Image") then
      return last
    else
      return nil
    end
  else
    return nil
  end
end

function figureFromPara(el, captionRequired)
  if captionRequired == nil then
    captionRequired = true
  end
  if #el.content == 1 and el.content[1].t == "Image" then
    local image = el.content[1]
    if not captionRequired or #image.caption > 0 then
      return image
    else
      return nil
    end
  else
    return nil
  end
end

function linkedFigureFromPara(el, captionRequired)
  if captionRequired == nil then
    captionRequired = true
  end
  if #el.content == 1 and el.content[1].t == "Link" then
    local link = el.content[1]
    if #link.content == 1 and link.content[1].t == "Image" then
      local image = link.content[1]
      if not captionRequired or #image.caption > 0 then
        return image
      end
    end
  end
  return nil
end


-- pandoc.lua
-- Copyright (C) 2020 by RStudio, PBC

-- check for latex output
function isLatexOutput()
  return FORMAT == "latex"
end

-- check for docx output
function isDocxOutput()
  return FORMAT == "docx"
end

-- check for html output
function isHtmlOutput()
  local formats = {
    "html",
    "html4",
    "html5",
    "s5",
    "dzslides",
    "slidy",
    "slideous",
    "revealjs",
    "epub",
    "epub2",
    "epub3"
  }
  return tcontains(formats, FORMAT)

end

-- read attribute w/ default
function attribute(el, name, default)
  local value = el.attr.attributes[name]
  if value ~= nil then
    return value
  else
    return default
  end
end

-- combine a set of filters together (so they can be processed in parallel)
function combineFilters(filters)
  local combined = {}
  for _, filter in ipairs(filters) do
    for key,func in pairs(filter) do
      local combinedFunc = combined[key]
      if combinedFunc then
         combined[key] = function(x)
           return func(combinedFunc(x))
         end
      else
        combined[key] = func
      end
    end
  end
  return combined
end

function inlinesToString(inlines)
  return pandoc.utils.stringify(pandoc.Span(inlines))
end

-- lua string to pandoc inlines
function stringToInlines(str)
  if str then
    return pandoc.List:new({pandoc.Str(str)})
  else
    return nil
  end
end

-- lua string with markdown to pandoc inlines
function markdownToInlines(str)
  if str then
    local doc = pandoc.read(str)
    return doc.blocks[1].content
  else
    return nil
  end
end

-- non-breaking space
function nbspString()
  return pandoc.Str '\u{a0}'
end


--
-- json.lua
--
-- Copyright (c) 2020 rxi
-- https://github.com/rxi/json.lua
--
-- Permission is hereby granted, free of charge, to any person obtaining a copy of
-- this software and associated documentation files (the "Software"), to deal in
-- the Software without restriction, including without limitation the rights to
-- use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
-- of the Software, and to permit persons to whom the Software is furnished to do
-- so, subject to the following conditions:
--
-- The above copyright notice and this permission notice shall be included in all
-- copies or substantial portions of the Software.
--
-- THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
-- IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
-- FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
-- AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
-- LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
-- OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
-- SOFTWARE.
--

local json = { _version = "0.1.2" }

-------------------------------------------------------------------------------
-- Encode
-------------------------------------------------------------------------------

local encode

local escape_char_map = {
  [ "\\" ] = "\\",
  [ "\"" ] = "\"",
  [ "\b" ] = "b",
  [ "\f" ] = "f",
  [ "\n" ] = "n",
  [ "\r" ] = "r",
  [ "\t" ] = "t",
}

local escape_char_map_inv = { [ "/" ] = "/" }
for k, v in pairs(escape_char_map) do
  escape_char_map_inv[v] = k
end


local function escape_char(c)
  return "\\" .. (escape_char_map[c] or string.format("u%04x", c:byte()))
end


local function encode_nil(val)
  return "null"
end


local function encode_table(val, stack)
  local res = {}
  stack = stack or {}

  -- Circular reference?
  if stack[val] then error("circular reference") end

  stack[val] = true

  if rawget(val, 1) ~= nil or next(val) == nil then
    -- Treat as array -- check keys are valid and it is not sparse
    local n = 0
    for k in pairs(val) do
      if type(k) ~= "number" then
        error("invalid table: mixed or invalid key types")
      end
      n = n + 1
    end
    if n ~= #val then
      error("invalid table: sparse array")
    end
    -- Encode
    for i, v in ipairs(val) do
      table.insert(res, encode(v, stack))
    end
    stack[val] = nil
    return "[" .. table.concat(res, ",") .. "]"

  else
    -- Treat as an object
    for k, v in pairs(val) do
      if type(k) ~= "string" then
        error("invalid table: mixed or invalid key types")
      end
      table.insert(res, encode(k, stack) .. ":" .. encode(v, stack))
    end
    stack[val] = nil
    return "{" .. table.concat(res, ",") .. "}"
  end
end


local function encode_string(val)
  return '"' .. val:gsub('[%z\1-\31\\"]', escape_char) .. '"'
end


local function encode_number(val)
  -- Check for NaN, -inf and inf
  if val ~= val or val <= -math.huge or val >= math.huge then
    error("unexpected number value '" .. tostring(val) .. "'")
  end
  return string.format("%.14g", val)
end


local type_func_map = {
  [ "nil"     ] = encode_nil,
  [ "table"   ] = encode_table,
  [ "string"  ] = encode_string,
  [ "number"  ] = encode_number,
  [ "boolean" ] = tostring,
}


encode = function(val, stack)
  local t = type(val)
  local f = type_func_map[t]
  if f then
    return f(val, stack)
  end
  error("unexpected type '" .. t .. "'")
end


function jsonEncode(val)
  return ( encode(val) )
end


-------------------------------------------------------------------------------
-- Decode
-------------------------------------------------------------------------------

local parse

local function create_set(...)
  local res = {}
  for i = 1, select("#", ...) do
    res[ select(i, ...) ] = true
  end
  return res
end

local space_chars   = create_set(" ", "\t", "\r", "\n")
local delim_chars   = create_set(" ", "\t", "\r", "\n", "]", "}", ",")
local escape_chars  = create_set("\\", "/", '"', "b", "f", "n", "r", "t", "u")
local literals      = create_set("true", "false", "null")

local literal_map = {
  [ "true"  ] = true,
  [ "false" ] = false,
  [ "null"  ] = nil,
}


local function next_char(str, idx, set, negate)
  for i = idx, #str do
    if set[str:sub(i, i)] ~= negate then
      return i
    end
  end
  return #str + 1
end


local function decode_error(str, idx, msg)
  local line_count = 1
  local col_count = 1
  for i = 1, idx - 1 do
    col_count = col_count + 1
    if str:sub(i, i) == "\n" then
      line_count = line_count + 1
      col_count = 1
    end
  end
  error( string.format("%s at line %d col %d", msg, line_count, col_count) )
end


local function codepoint_to_utf8(n)
  -- http://scripts.sil.org/cms/scripts/page.php?site_id=nrsi&id=iws-appendixa
  local f = math.floor
  if n <= 0x7f then
    return string.char(n)
  elseif n <= 0x7ff then
    return string.char(f(n / 64) + 192, n % 64 + 128)
  elseif n <= 0xffff then
    return string.char(f(n / 4096) + 224, f(n % 4096 / 64) + 128, n % 64 + 128)
  elseif n <= 0x10ffff then
    return string.char(f(n / 262144) + 240, f(n % 262144 / 4096) + 128,
                       f(n % 4096 / 64) + 128, n % 64 + 128)
  end
  error( string.format("invalid unicode codepoint '%x'", n) )
end


local function parse_unicode_escape(s)
  local n1 = tonumber( s:sub(1, 4),  16 )
  local n2 = tonumber( s:sub(7, 10), 16 )
   -- Surrogate pair?
  if n2 then
    return codepoint_to_utf8((n1 - 0xd800) * 0x400 + (n2 - 0xdc00) + 0x10000)
  else
    return codepoint_to_utf8(n1)
  end
end


local function parse_string(str, i)
  local res = ""
  local j = i + 1
  local k = j

  while j <= #str do
    local x = str:byte(j)

    if x < 32 then
      decode_error(str, j, "control character in string")

    elseif x == 92 then -- `\`: Escape
      res = res .. str:sub(k, j - 1)
      j = j + 1
      local c = str:sub(j, j)
      if c == "u" then
        local hex = str:match("^[dD][89aAbB]%x%x\\u%x%x%x%x", j + 1)
                 or str:match("^%x%x%x%x", j + 1)
                 or decode_error(str, j - 1, "invalid unicode escape in string")
        res = res .. parse_unicode_escape(hex)
        j = j + #hex
      else
        if not escape_chars[c] then
          decode_error(str, j - 1, "invalid escape char '" .. c .. "' in string")
        end
        res = res .. escape_char_map_inv[c]
      end
      k = j + 1

    elseif x == 34 then -- `"`: End of string
      res = res .. str:sub(k, j - 1)
      return res, j + 1
    end

    j = j + 1
  end

  decode_error(str, i, "expected closing quote for string")
end


local function parse_number(str, i)
  local x = next_char(str, i, delim_chars)
  local s = str:sub(i, x - 1)
  local n = tonumber(s)
  if not n then
    decode_error(str, i, "invalid number '" .. s .. "'")
  end
  return n, x
end


local function parse_literal(str, i)
  local x = next_char(str, i, delim_chars)
  local word = str:sub(i, x - 1)
  if not literals[word] then
    decode_error(str, i, "invalid literal '" .. word .. "'")
  end
  return literal_map[word], x
end


local function parse_array(str, i)
  local res = {}
  local n = 1
  i = i + 1
  while 1 do
    local x
    i = next_char(str, i, space_chars, true)
    -- Empty / end of array?
    if str:sub(i, i) == "]" then
      i = i + 1
      break
    end
    -- Read token
    x, i = parse(str, i)
    res[n] = x
    n = n + 1
    -- Next token
    i = next_char(str, i, space_chars, true)
    local chr = str:sub(i, i)
    i = i + 1
    if chr == "]" then break end
    if chr ~= "," then decode_error(str, i, "expected ']' or ','") end
  end
  return res, i
end


local function parse_object(str, i)
  local res = {}
  i = i + 1
  while 1 do
    local key, val
    i = next_char(str, i, space_chars, true)
    -- Empty / end of object?
    if str:sub(i, i) == "}" then
      i = i + 1
      break
    end
    -- Read key
    if str:sub(i, i) ~= '"' then
      decode_error(str, i, "expected string for key")
    end
    key, i = parse(str, i)
    -- Read ':' delimiter
    i = next_char(str, i, space_chars, true)
    if str:sub(i, i) ~= ":" then
      decode_error(str, i, "expected ':' after key")
    end
    i = next_char(str, i + 1, space_chars, true)
    -- Read value
    val, i = parse(str, i)
    -- Set
    res[key] = val
    -- Next token
    i = next_char(str, i, space_chars, true)
    local chr = str:sub(i, i)
    i = i + 1
    if chr == "}" then break end
    if chr ~= "," then decode_error(str, i, "expected '}' or ','") end
  end
  return res, i
end


local char_func_map = {
  [ '"' ] = parse_string,
  [ "0" ] = parse_number,
  [ "1" ] = parse_number,
  [ "2" ] = parse_number,
  [ "3" ] = parse_number,
  [ "4" ] = parse_number,
  [ "5" ] = parse_number,
  [ "6" ] = parse_number,
  [ "7" ] = parse_number,
  [ "8" ] = parse_number,
  [ "9" ] = parse_number,
  [ "-" ] = parse_number,
  [ "t" ] = parse_literal,
  [ "f" ] = parse_literal,
  [ "n" ] = parse_literal,
  [ "[" ] = parse_array,
  [ "{" ] = parse_object,
}


parse = function(str, idx)
  local chr = str:sub(idx, idx)
  local f = char_func_map[chr]
  if f then
    return f(str, idx)
  end
  decode_error(str, idx, "unexpected character '" .. chr .. "'")
end


function jsonDecode(str)
  if type(str) ~= "string" then
    error("expected argument of type string, got " .. type(str))
  end
  local res, idx = parse(str, next_char(str, 1, space_chars, true))
  idx = next_char(str, idx, space_chars, true)
  if idx <= #str then
    decode_error(str, idx, "trailing garbage")
  end
  return res
end



-- table.lua
-- Copyright (C) 2020 by RStudio, PBC

function tablePanel(divEl, subfigures)
  
    -- create panel
  local panel = pandoc.Div({})
  
  -- alignment
  local align = tableAlign(attribute(divEl, "fig-align", "default"))
  
  -- subfigures
  local subfiguresEl = pandoc.Para({})
  for i, row in ipairs(subfigures) do
    
    local aligns = row:map(function() return align end)
    local widths = row:map(function() return 0 end)
     
    local figuresRow = pandoc.List:new()
    for _, image in ipairs(row) do
      local cell = pandoc.List:new()
      if image.t == "Image" then
        cell:insert(pandoc.Para(image))
      else
        cell:insert(image)
      end
      figuresRow:insert(cell)
    end
    
    -- make the table
    local figuresTable = pandoc.SimpleTable(
      pandoc.List:new(), -- caption
      aligns,
      widths,
      pandoc.List:new(), -- headers
      { figuresRow }
    )
    
    -- add it to the panel
    panel.content:insert(pandoc.utils.from_simple_table(figuresTable))
  end
  
  -- insert caption
  local divCaption = figureDivCaption(divEl)
  if divCaption and #divCaption.content > 0 then
    panel.content:insert(divCaption)
  end
  
  -- return panel
  return panel
end

function tableAlign(align)
  if align == "left" then
    return pandoc.AlignLeft
  elseif align == "center" then
    return pandoc.AlignCenter
  elseif align == "right" then
    return pandoc.AlignRight
  else
    return pandoc.AlignDefault
  end
end

-- html.lua
-- Copyright (C) 2020 by RStudio, PBC

-- todo: out-width doesn't seem to drive the grid (for latex at least)

-- todo: consider native docx tables for office output

function htmlPanel(divEl, subfigures)
  
  -- set flag indicating we need panel css
  figures.htmlPanels = true
  
  -- outer panel to contain css and figure panel
  local panel = pandoc.Div({}, pandoc.Attr("", { "quarto-figure-panel" }))

  -- enclose in figure
  panel.content:insert(pandoc.RawBlock("html", "<figure>"))
  
  -- collect alignment
  local align = attribute(divEl, "fig-align", nil)
  divEl.attr.attributes["fig-align"] = nil

  -- subfigures
  local subfiguresEl = pandoc.Para({})
  for i, row in ipairs(subfigures) do
    
    local figuresRow = pandoc.Div({}, pandoc.Attr("", {"quarto-subfigure-row"}))
    if align then
      appendStyle(figuresRow, "justify-content: " .. flexAlign(align) .. ";")
    end
    
    for i, image in ipairs(row) do
      
      -- create div to contain figure
      local figureDiv = pandoc.Div({}, pandoc.Attr("", {"quarto-subfigure"}))
      
      -- transfer any width and height to the container
      local figureDivStyle = ""
      local width = image.attr.attributes["width"]
      if width then
        figureDivStyle = figureDivStyle .. "width: " .. width .. ";"
        image.attr.attributes["width"] = nil
      end
      local height = image.attr.attributes["height"]
      if height then
        figureDivStyle = figureDivStyle .. "height: " .. height .. ";"
        image.attr.attributes["height"] = nil
      end
      if string.len(figureDivStyle) > 0 then
        figureDiv.attr.attributes["style"] = figureDivStyle
      end
      
      -- add figure to div
      if image.t == "Image" then
        figureDiv.content:insert(pandoc.Para(image))
      else
        figureDiv.content:insert(image)
      end
      
      -- add div to row
      figuresRow.content:insert(figureDiv)
    end
    
    -- add row to the panel
    panel.content:insert(figuresRow)
  end
  
  -- insert caption and </figure>
  local divCaption = figureDivCaption(divEl)
  if divCaption and #divCaption.content > 0 then
    local caption = pandoc.Para({})
    -- apply alignment if we have it
    local figcaption = "<figcaption aria-hidden=\"true\""
    if align then
      figcaption = figcaption .. " style=\"text-align: " .. align .. ";\""
    end
    figcaption = figcaption .. ">"
    
    caption.content:insert(pandoc.RawInline("html", figcaption))
    tappend(caption.content, divCaption.content)
    caption.content:insert(pandoc.RawInline("html", "</figcaption>"))
    panel.content:insert(caption)
  end
  
  panel.content:insert(pandoc.RawBlock("html", "</figure>"))
  
  -- return panel
  return panel
end

function appendStyle(el, style)
  local baseStyle = attribute(el, "style", "")
  if baseStyle ~= "" and not string.find(baseStyle, ";$") then
    baseStyle = baseStyle .. ";"
  end
  el.attr.attributes["style"] = baseStyle .. style
end

function flexAlign(align)
  if align == "left" then
    return "flex-start"
  elseif align == "center" then
    return "center"
  elseif align == "right" then
    return "flex-end"
  else
    return nil
  end
end



-- latex.lua
-- Copyright (C) 2020 by RStudio, PBC

function latexFigureDiv(divEl, subfigures)
  
  -- create panel
  local figure = pandoc.Div({})
  
  -- begin the figure
  local figEnv = attribute(divEl, "fig-env", "figure")
  figure.content:insert(pandoc.RawBlock("latex", "\\begin{" .. figEnv .. "}"))
  
  -- alignment
  local align = attribute(divEl, "fig-align", nil)
  if align then
    figure.content:insert(latexBeginAlign(align))
  end
  
  -- subfigures
  if subfigures then
    local subfiguresEl = pandoc.Para({})
    for i, row in ipairs(subfigures) do
      
      for _, image in ipairs(row) do
        
        -- begin subfigure
        subfiguresEl.content:insert(pandoc.RawInline("latex", "\\begin{subfigure}[b]"))
         
        -- check to see if it has a width to apply (if so then reset the
        -- underlying width to 100% as sizing will come from subfigure box)
        local layoutPercent = horizontalLayoutPercent(image)
        if layoutPercent then
          image.attr.attributes["width"] = nil
        else
          layoutPercent = 100
        end
        subfiguresEl.content:insert(pandoc.RawInline("latex", 
          "{" .. string.format("%2.2f", layoutPercent/100) .. "\\linewidth}"
        ))
        
        -- see if have a caption (different depending on whether it's an Image or Div)
        local caption = nil
        if image.t == "Image" then
          caption = image.caption:clone()
          tclear(image.caption)
        else 
          caption = figureDivCaption(image).content
        end
        
        -- build caption (if there is no caption then use a \phantomcaption)
        if #caption > 0 then
          caption:insert(1, pandoc.RawInline("latex", "  \\caption{"))
          caption:insert(pandoc.RawInline("latex", "\\label{" .. image.attr.identifier .. "}}\n"))
        end
        image.attr.identifier = ""
        
        -- insert content
        subfiguresEl.content:insert(pandoc.RawInline("latex", "\n  "))
        if image.t == "Div" then
          -- append the div, slicing off the caption block
          tappend(subfiguresEl.content, pandoc.utils.blocks_to_inlines(
            tslice(image.content, 1, #image.content-1),
            { pandoc.LineBreak() }
          ))
        else
          subfiguresEl.content:insert(image)
        end
        subfiguresEl.content:insert(pandoc.RawInline("latex", "\n"))
        
        -- insert caption
        if #caption > 0 then
          tappend(subfiguresEl.content, caption)
        end
      
        -- end subfigure
        subfiguresEl.content:insert(pandoc.RawInline("latex", "\\end{subfigure}\n"))
        
      end
      
      -- insert separator unless this is the last row
      if i < #subfigures then
        subfiguresEl.content:insert(pandoc.RawInline("latex", "\\newline\n"))
      end
      
    end
    figure.content:insert(subfiguresEl)
  --  no subfigures, just forward content
  else
    tappend(figure.content, tslice(divEl.content, 1, #divEl.content - 1))
  end
  
  -- end alignment
  if align then
    figure.content:insert(latexEndAlign(align))
  end
  
  -- surround caption w/ appropriate latex (and end the figure)
  local caption = figureDivCaption(divEl)
  if caption and #caption.content > 0 then
    caption.content:insert(1, pandoc.RawInline("latex", "\\caption{"))
    tappend(caption.content, {
      pandoc.RawInline("latex", "}\\label{" .. divEl.attr.identifier .. "}\n"),
    })
    figure.content:insert(caption)
  end
  
  -- end figure
  figure.content:insert(pandoc.RawBlock("latex", "\\end{" .. figEnv .. "}"))
  
  -- return the figure
  return figure
  
end


function latexBeginAlign(align)
  local beginAlign = pandoc.RawBlock("latex", "\n")
  if align == "center" then
    beginAlign.text = "{\\centering"
  elseif align == "right" then
    beginAlign.text = "\\hfill{}"      
  end
  return beginAlign
end

function latexEndAlign(align)
  local endAlign = pandoc.RawBlock("latex", "\n")
  if align == "center" then
    endAlign.text = "}"
  elseif align == "left" then
    endAlign.text = "\\hfill{}"
  end
  return endAlign
end


-- align1 = if (plot1)
--    switch(a, left = '\n\n', center = '\n\n{\\centering ', right = '\n\n\\hfill{}', '\n')
--  # close align code if this picture is standalone/last in set
--  align2 = if (plot2)
--    switch(a, left = '\\hfill{}\n\n', center = '\n\n}\n\n', right = '\n\n', '')





-- layout.lua
-- Copyright (C) 2020 by RStudio, PBC 
 
function layoutSubfigures(divEl)
   
  -- There are various ways to specify figure layout:
  --
  --  1) Directly in markup using explicit widths and <hr> to 
  --     delimit rows
  --  2) By specifying fig-cols. In this case widths can be explicit 
  --     and/or automatically distributed (% widths required for 
  --     mixing explicit and automatic widths)
  --  3) By specifying fig-layout (nested arrays defining explicit
  --     rows and figure widths)
  --
  
  -- collect all the subfigures (bail if there are none)
  local subfigures = collectSubfigures(divEl)
  if not subfigures then
    return nil
  end
  
   -- init layout
  local layout = pandoc.List:new()

  -- note any figure layout attributes
  local figCols = tonumber(attribute(divEl, "fig-cols", nil))
  local figLayout = attribute(divEl, "fig-layout", nil)
  
  -- if there are horizontal rules then use that for layout
  if haveHorizontalRules(subfigures) then
    layout:insert(pandoc.List:new())
    for _,fig in ipairs(subfigures) do
      if fig.t == "HorizontalRule" then
        layout:insert(pandoc.List:new())
      else
        layout[#layout]:insert(fig)
      end
    end
    -- allocate remaining space
    layoutWidths(layout)
    
  -- check for fig-cols
  elseif figCols ~= nil then
    for i,fig in ipairs(subfigures) do
      if math.fmod(i-1, figCols) == 0 then
        layout:insert(pandoc.List:new())
      end
      layout[#layout]:insert(fig)
    end
    -- allocate remaining space
    layoutWidths(layout, figCols)
    
  -- check for fig-layout
  elseif figLayout ~= nil then
    -- parse the layout
    figLayout = parseFigLayout(figLayout)
    
    -- manage/perform next insertion into the layout
    local subfigIndex = 1
    function layoutNextSubfig(width)
      local subfig = subfigures[subfigIndex]
      subfigIndex = subfigIndex + 1
      subfig.attr.attributes["width"] = width
      subfig.attr.attributes["height"] = nil
      layout[#layout]:insert(subfig)
    end
  
    -- process the layout
    for _,item in ipairs(figLayout) do
      if subfigIndex > #subfigures then
        break
      end
      layout:insert(pandoc.List:new())
      for _,width in ipairs(item) do
        layoutNextSubfig(width)
      end
    end
    
    -- if there are leftover figures just put them in their own row
    if subfigIndex <= #subfigures then
      layout:insert(pandoc.List:new(tslice(subfigures, subfigIndex)))
    end
    
  -- no layout, single column
  else
    for _,fig in ipairs(subfigures) do
      layout:insert(pandoc.List:new({fig}))
    end
    layoutWidths(layout)
  end

  -- return the layout
  return layout

end

function collectSubfigures(divEl)
  if isFigureDiv(divEl, false) then
    local subfigures = pandoc.List:new()
    pandoc.walk_block(divEl, {
      Div = function(el)
        if isSubfigure(el) then
          subfigures:insert(el)
          el.attr.attributes["figure-parent"] = nil
        end
      end,
      Para = function(el)
        local image = figureFromPara(el, false)
        if image and isSubfigure(image) then
          subfigures:insert(image)
          image.attr.attributes["figure-parent"] = nil
        end
      end,
      HorizontalRule = function(el)
        subfigures:insert(el)
      end
    })
    if #subfigures > 0 then
      return subfigures
    else
      return nil
    end
  else
    return nil
  end
end


-- parse a fig-layout specification
function parseFigLayout(figLayout)
  
  -- parse json
  figLayout = pandoc.List:new(jsonDecode(figLayout))
  
  -- if there are no tables then make a table and stick the items in it
  if not figLayout:find_if(function(item) return type(item) == "table" end) then
     figLayout = pandoc.List:new({figLayout})
  end
      
  -- validate that layout is now all rows
  if figLayout:find_if(function(item) return type(item) ~= "table" end) then
    error("Invalid figure layout specification " .. 
          "(cannot mix rows and items at the top level")
  end
  
  -- convert numbers to strings as appropriate
  figLayout = figLayout:map(function(row)
    return pandoc.List:new(row):map(function(width)
      if type(width) == "number" then
        if width <= 1 then
          width = math.floor(width * 100)
        end
        width = tostring(width) .. "%"
      end
      return width
    end)
  end)
   
  -- return the layout
  return figLayout
  
end

-- interpolate any missing widths
function layoutWidths(figLayout, cols)
  for _,row in ipairs(figLayout) do
    if canLayoutFigureRow(row) then
      allocateRowWidths(row, cols)
    end
  end
end


-- find allocated row percentages
function allocateRowWidths(row, cols)
  
  -- determine which figs need allocation and how much is left over to allocate
  local available = 96
  local unallocatedFigs = pandoc.List:new()
  for _,fig in ipairs(row) do
    local width = attribute(fig, "width", nil)
    local percent = widthToPercent(width)
    if percent then
       available = available - percent
    else
      unallocatedFigs:insert(fig)
    end
  end
  
  -- pad to cols
  if cols and #row < cols then
    for i=#row+1,cols do
      unallocatedFigs:insert("nil")
    end
  end
  

  -- do the allocation
  if #unallocatedFigs > 0 then
    -- minimum of 10% allocation
    available = math.max(available, #unallocatedFigs * 10)
    allocation = math.floor(available / #unallocatedFigs)
    for _,fig in ipairs(unallocatedFigs) do
      if fig ~= "nil" then
        fig.attr.attributes["width"] = tostring(allocation) .. "%"
      end
    end
  end

end

-- a non-% width or a height disqualifies the row
function canLayoutFigureRow(row)
  for _,fig in ipairs(row) do
    local width = attribute(fig, "width", nil)
    if width and not widthToPercent(width) then
      return false
    elseif attribute(fig, "height", nil) ~= nil then
      return false
    end
  end
  return true
end

function widthToPercent(width)
  if width then
    local percent = string.match(width, "^(%d+)%%$")
    if percent then
      return tonumber(percent)
    end
  end
  return nil
end

function haveHorizontalRules(subfigures)
  if subfigures:find_if(function(fig) return fig.t == "HorizontalRule" end) then
    return true
  else
    return false
  end
end

-- elements with a percentage width and no height have a 'layout percent'
-- which means then should be laid out at a higher level in the tree than
-- the individual figure element
function horizontalLayoutPercent(el)
  local percentWidth = widthToPercent(el.attr.attributes["width"])
  if percentWidth and not el.attr.attributes["height"] then
    return percentWidth 
  else
    return nil
  end
end

-- meta.lua
-- Copyright (C) 2020 by RStudio, PBC

-- inject metadata
function metaInject()
  return {
    Pandoc = function(doc)
      
      metaInjectLatex(doc, function(inject)
        inject(
          usePackage("caption") .. "\n" ..
          usePackage("subcaption")
        )
      end)
      
      metaInjectHtml(doc, function(inject)
        if figures.htmlPanels then
          inject([[
<style type="text/css">
  .quarto-figure figure {
    display: inline-block;
  }
  .quarto-subfigure-row {
    display: flex;
    align-items: flex-end;
  }
  .quarto-subfigure {
    position: relative;
  }
  .quarto-subfigure figure {
    margin: 0.2em;
  }
  .quarto-subfigure figcaption {
    text-align: center;
  }
  .quarto-subfigure div figure p {
    margin: 0;
  }
  .quarto-subfigure figcaption {
    font-size: 0.8em;
    font-style: italic;
  }
  figure > p:empty {
    display: none;
  }
  figure > p:first-child {
    margin-top: 0;
    margin-bottom: 0;
  }
</style>
]]
          )
        end
      end)
      
      return doc
    end
  }
end


-- figures.lua
-- Copyright (C) 2020 by RStudio, PBC

-- required modules
text = require 'text'

-- global figures state
figures = {}



function layoutFigures() 
  
  return {
    
    Div = function(el)
      
      if isFigureDiv(el, false) then
        
        -- handle subfigure layout
        local subfigures = layoutSubfigures(el)
        if subfigures then
          if isLatexOutput() then
            return latexFigureDiv(el, subfigures)
          elseif isHtmlOutput() then
            return htmlPanel(el, subfigures)
          else
            return tablePanel(el, subfigures)
          end
          
        -- turn figure divs into <figure> tag for html
        elseif isHtmlOutput() then
          local figureDiv = pandoc.Div({}, el.attr)
          
          -- apply standalone figure css if we are not a subfigure
          if not isSubfigure(figureDiv) then
            figureDiv.attr.classes:insert("quarto-figure")
            local align = attribute(figureDiv, "fig-align", nil)
            figureDiv.attr.attributes["fig-align"] = nil
            if align then
              appendStyle(figureDiv, "text-align: " .. align .. ";")
            end
          end
          
          figureDiv.content:insert(pandoc.RawBlock("html", "<figure>"))
          tappend(figureDiv.content, tslice(el.content, 1, #el.content-1))
          local captionInlines = figureDivCaption(el).content
          if #captionInlines > 0 then
            local figureCaption = pandoc.Para({})
            figureCaption.content:insert(pandoc.RawInline(
              "html", "<figcaption aria-hidden=\"true\">"
            ))
            tappend(figureCaption.content, captionInlines) 
            figureCaption.content:insert(pandoc.RawInline("html", "</figcaption>"))
            figureDiv.content:insert(figureCaption)
          end
          figureDiv.content:insert(pandoc.RawBlock("html", "</figure>"))
          return figureDiv
    
        -- turn figure divs into \begin{figure} for latex (but not if they
        -- have a parent as that will be done during subfigure layout)
        elseif isLatexOutput() and not isSubfigure(el)  then
          return latexFigureDiv(el)
        end
      end
    end
  }
end


-- chain of filters
return {
  preprocessFigures(false),
  layoutFigures(),
  metaInject()
}


