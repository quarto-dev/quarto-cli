-- observable.lua
-- Copyright (C) 2020 by RStudio, PBC

function observable()

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
      -- FIXME Handle all https://pandoc.org/lua-filters.html#type-inline
      -- FIXME How do I signal an internal error here?
      print("WILL FAIL CANNOT HANDLE TYPE")
      print(inline.t)
      return nil
    end
  end

  function inlines_rec(inlines)
    -- FIXME I haven't tested this for nested interpolations
    local i = find_arg_if(inlines, isInterpolationOpen)
    if i then
      local j = find_arg_if(inlines, isInterpolationClose, i)
      if j then
        local is, ie = inlines[i].text:find("${")
        local js, je = inlines[j].text:find("}")
        local beforeFirst = inlines[i].text:sub(1, is - 1)
        local firstChunk = inlines[i].text:sub(ie + 1, -1)
        local lastChunk = inlines[j].text:sub(1, js - 1)
        local afterLast = inlines[j].text:sub(je + 1, -1)
        inlines[i].text = firstChunk
        inlines[j].text = lastChunk
        -- this is O(n^2) where n is the length of the run that makes the interpolator
        -- FIXME instead, add them all to a table at once, concat, then remove all
        -- at once.
        for k=i+1, j do
          inlines[i].text = inlines[i].text .. string_content(inlines[i+1])
          inlines:remove(i+1)
        end
        inlines[i] = pandoc.Span({
            pandoc.Str(beforeFirst),
            observableInline(inlines[i].text),
            pandoc.Str(afterLast)
        })
        return inlines_rec(inlines) -- recurse to catch the next one
      end
    end
    return inlines
  end  

  if (param("observable", false)) then
    return {
      CodeBlock = function(el)
        
      end,
      
      DisplayMath = function(el)
      
      end,
      
      Inlines = function (inlines)
        return inlines_rec(inlines)
      end,
      
      Math = function(el)
        
      end,

      Pandoc = function(doc)
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
      end,
      
      RawBlock = function(el)
        
      end,
      
      RawInline = function(el)
      
      end,
      
      Str = function(el)
        local b, e, s = el.text:find("${(.+)}")
        if s then
          return pandoc.Span({
              pandoc.Str(string.sub(el.text, 1, b - 1)),
              observableInline(s),
              pandoc.Str(string.sub(el.text, e + 1, -1))
          })
        end
      end
    }
  else 
    return {}
  end

end
