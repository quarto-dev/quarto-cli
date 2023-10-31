-- ojs.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

function ojs()

  local uid = 0
  local cells = pandoc.List()

  local function uniqueId()
    uid = uid + 1
    return "ojs-element-id-" .. uid
  end

  local function ojsInline(src)
    local id = uniqueId()
    cells:insert({
        src = src,
        id = id,
        inline = true
    })
    return pandoc.Span('', { id = id })
  end

  local function isInterpolationOpen(str)
    if str.t ~= "Str" then
      return false
    end
    return str.text:find("${")
  end

  local function isInterpolationClose(str)
    if str.t ~= "Str" then
      return false
    end
    return str.text:find("}")
  end

  local function findArgIf(lst, fun, start)
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

  local function escapeSingle(str)
    local sub, _ = string.gsub(str, "'", "\\\\'")
    return sub
  end

  local function escapeDouble(str)
    local sub, _ = string.gsub(str, '"', '\\\\"')
    return sub
  end

  local stringifyTokens
  local stringifyTokenInto

  stringifyTokens = function(sequence)
    local result = pandoc.List()
    for i = 1, #sequence do
      stringifyTokenInto(sequence[i], result)
    end
    return table.concat(result, "")
  end

  stringifyTokenInto = function(token, sequence)
    local function unknown()
      fail_and_ask_for_bug_report("Don't know how to handle token " .. token.t)
    end
    if     token.t == 'Cite' then
      unknown()
    elseif token.t == 'Code' then
      sequence:insert('`')
      sequence:insert(token.text)
      sequence:insert('`')
    elseif token.t == 'Emph' then
      sequence:insert('*')
      sequence:insert(token.text)
      sequence:insert('*')
    elseif token.t == 'Image' then
      unknown()
    elseif token.t == 'LineBreak' then
      sequence:insert("\n")
    elseif token.t == 'Link' then
      unknown()
    elseif token.t == 'Math' then
      unknown()
    elseif token.t == 'Note' then
      unknown()
    elseif token.t == 'Quoted' then
      if token.quotetype == 'SingleQuote' then
        sequence:insert("'")
        local innerContent = stringifyTokens(token.content)
        sequence:insert(escapeSingle(innerContent))
        sequence:insert("'")
      else
        sequence:insert('"')
        local innerContent = stringifyTokens(token.content)
        sequence:insert(escapeDouble(innerContent))
        sequence:insert('"')
      end
    elseif token.t == 'RawInline' then
      sequence:insert(token.text)
    elseif token.t == 'SmallCaps' then
      unknown()
    elseif token.t == 'SoftBreak' then
      sequence:insert("\n")
    elseif token.t == 'Space' then
      sequence:insert(" ")
    elseif token.t == 'Span' then
      stringifyTokenInto(token.content, sequence)
    elseif token.t == 'Str' then
      sequence:insert(token.text)
    elseif token.t == 'Strikeout' then
      unknown()
    elseif token.t == 'Strong' then
      sequence:insert('**')
      sequence:insert(token.text)
      sequence:insert('**')
    elseif token.t == 'Superscript' then
      unknown()
    elseif token.t == 'Underline' then
      sequence:insert('_')
      sequence:insert(token.text)
      sequence:insert('_')
    else
      unknown()
    end
  end
  
  local function escape_quotes(str)
    local sub, _ = string.gsub(str, '\\', '\\\\')
    sub, _ = string.gsub(sub, '"', '\\"')
    sub, _ = string.gsub(sub, "'", "\\'")
    sub, _ = string.gsub(sub, '`', '\\\\`')
    return sub
  end
  
  local function inlines_rec(inlines)
    -- FIXME I haven't tested this for nested interpolations
    local i = findArgIf(inlines, isInterpolationOpen)
    while i do
      if i then
        local j = findArgIf(inlines, isInterpolationClose, i)
        if j then
          local is, ie = inlines[i].text:find("${")
          local js, je = inlines[j].text:find("}")
          local beforeFirst = inlines[i].text:sub(1, is - 1)
          local firstChunk = inlines[i].text:sub(ie + 1, -1)
          local lastChunk = inlines[j].text:sub(1, js - 1)
          local afterLast = inlines[j].text:sub(je + 1, -1)

          local slice = {pandoc.Str(firstChunk)}
          local slice_i = 2
          for k=i+1, j-1 do
            slice[slice_i] = inlines[i+1]
            slice_i = slice_i + 1
            inlines:remove(i+1)
          end
          slice[slice_i] = pandoc.Str(lastChunk)
          inlines:remove(i+1)
          inlines[i] = pandoc.Span({
              pandoc.Str(beforeFirst),
              ojsInline(stringifyTokens(slice)),
              pandoc.Str(afterLast)
          })
        end
        -- recurse
        i = findArgIf(inlines, isInterpolationOpen, i+1)
      end
    end
    return inlines
  end  

  if (param("ojs", false)) then
    return {
      Inlines = function (inlines)
        return inlines_rec(inlines)
      end,
      
      Pandoc = function(doc)
        if uid > 0 then
          local div = pandoc.Div({}, pandoc.Attr("", {"ojs-auto-generated", "hidden"}, {}))
          div.content:insert(pandoc.RawBlock("html", "<script type='ojs-module-contents'>"))
          div.content:insert(pandoc.RawBlock("html", '{"contents":['))
          for i, v in ipairs(cells) do
            if i > 1 then
              div.content:insert(",")
            end
            div.content:insert(
              pandoc.RawBlock(
                "html",
                ('  {"methodName":"interpret","inline":"true","source":"htl.html`<span>${' ..
                 escape_quotes(v.src) .. '}</span>`", "cellName":"' .. v.id .. '"}')))
          end
          div.content:insert(pandoc.RawBlock("html", ']}'))
          div.content:insert(pandoc.RawBlock("html", "</script>"))
          doc.blocks:insert(div)
        end
        return doc
      end,
      
      Str = function(el)
        local b, e, s = el.text:find("${(.+)}")
        if s then
          return pandoc.Span({
              pandoc.Str(string.sub(el.text, 1, b - 1)),
              ojsInline(s),
              pandoc.Str(string.sub(el.text, e + 1, -1))
          })
        end
      end
    }
  else 
    return {}
  end

end
