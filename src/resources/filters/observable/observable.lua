-- blocks

local uid = 0
local cells = pandoc.List:new()

function uniqueId()
  uid = uid + 1
  return "observable-element-id-" .. uid
end

function observableInline(src)
  local id = uniqueId()
  cells:insert({
      src = src,
      id = id,
      inline = true
  })
  return pandoc.Span('', { id = id })
end

function observableBlock(src)
  local id = uniqueId()
  cells:insert({
      src = src,
      id = id,
      inline = false
  })
  return pandoc.Div('', { id = id })
end

-- Does not appear to be working right now.. I wonder if this is what JJ discussed on slack
--
-- function CodeBlock(el)
--   if el.attr.classes:find("{ojs}") then
--     return observableBlock(el.content)
--   end
-- end

function DisplayMath(el)

end

function RawBlock(el)
  if el.format == "html" then

  elseif el.format == "tex" then
  
  end
end

function isInterpolationOpen(str)
  if str.t ~= "Str" then
    return false
  end
  return str.text:find("${")
end

function isInterpolationClose(str)
  if str.t ~= "Str" then
    return false
  end
  return str.text:find("}")
end

function find_arg_if(lst, fun, start)
  if start == nil then
    start = 1
  end
  local sz = #lst
  for i=start, sz do
    if fun(lst[i]) then
      return i
    end
  end
  return nil
end

function string_content(inline)
  if inline.t == "Space" then
    return " "
  elseif inline.t == "Str" then
    return inline.text
  elseif inline.t == "Quoted" then
    local internal_content = table.concat(inline.content:map(string_content), "")
    local q = ""
    if inline.quotetype == "SingleQuote" then
      q = "'"
    else
      q = '"'
    end
    -- FIXME escaping?
    return q .. internal_content .. q
  elseif inline.t == "Code" then
    -- Because Code inlines are denoted in Pandoc with backticks, we use
    -- this as an opportunity to handle a construct that wouldn't typically work
    --
    -- FIXME What about `{r} foo`?
    return "\\`" .. inline.text .. "\\`"
  else
    -- FIXME how do I know all possible types?
    print("WILL FAIL CANNOT HANDLE TYPE")
    print(inline.t)
    return nil
  end
end

-- I haven't tested this at all for nested interpolations...
function Inlines(inlines)
  local i = find_arg_if(inlines, isInterpolationOpen)
  if i then
    local j = find_arg_if(inlines, isInterpolationClose, i)
    if j then
      -- print("Starts at ", i, inlines[i].text, " and ends at ", j, inlines[j].text)
      local is, ie = inlines[i].text:find("${")
      local js, je = inlines[j].text:find("}")
      local beforeFirst = inlines[i].text:sub(1, is - 1)
      local firstChunk = inlines[i].text:sub(ie + 1, -1)
      local lastChunk = inlines[j].text:sub(1, js - 1)
      local afterLast = inlines[j].text:sub(je + 1, -1)
      inlines[i].text = firstChunk
      inlines[j].text = lastChunk
      -- this is O(n^2) where n is the length of the run that makes the interpolator..
      for k=i+1, j do
        inlines[i].text = inlines[i].text .. string_content(inlines[i+1])
        inlines:remove(i+1)
      end
      inlines[i] = pandoc.Span({
          pandoc.Str(beforeFirst),
          observableInline(inlines[i].text),
          pandoc.Str(afterLast)
      })
      return Inlines(inlines) -- recurse to catch the next one
    end
  end
  return inlines
end

-- inlines
function Math(el)

end

function RawInline(el)
  
end

-- https://pandoc.org/lua-filters.html#macro-substitution
function Str(el)
  local b, e, s = el.text:find("${(.+)}")
  if s then
    return pandoc.Span({
        pandoc.Str(string.sub(el.text, 1, b - 1)),
        observableInline(s),
        pandoc.Str(string.sub(el.text, e + 1, -1))
    })
  end
end

-- here we add the interpret calls to actually process the inline cells
function Pandoc(doc)
  if uid > 0 then
    doc.blocks:insert(pandoc.RawBlock("html", "<script type='module'>"))
    for i, v in ipairs(cells) do
      local inlineStr = ''
      if v.inline then
        inlineStr = 'true'
      else
        inlineStr = 'false'
      end
      doc.blocks:insert(pandoc.RawBlock("html", "  window._ojsRuntime.interpret(`" .. v.src .. "`, document.getElementById('" .. v.id .. "'), " .. inlineStr .. ");"));
    end
    doc.blocks:insert(pandoc.RawBlock("html", "</script>"))
  end
  return doc
end

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
  if tbl.t then
    print(string.rep("  ", indent) .. tbl.t)
  end
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

