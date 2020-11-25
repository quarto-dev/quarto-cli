

function processTables(doc)


  filterDoc(doc, {

    Div = function(el)
      if isTableDiv(el) then
        -- look for various ways of expressing tables in a div
        local processors = { processMarkdownTable, processRawTable }
        for _, process in ipairs(processors) do
          local tblDiv = process(el)
          if tblDiv then
            return tblDiv
          end
        end
      end
      -- default to just reflecting the div back
      return el
    end,


    Table = function(el)
      -- if there is a caption then check it for a table suffix
      if el.caption.long ~= nil then
        local last = el.caption.long[#el.caption.long]
        if last and #last.content > 2 then
          local lastInline = last.content[#last.content]
          local label = string.match(lastInline.text, "^{#(tbl:[^ }]+)}$")
          if label and last.content[#last.content-1].t == "Space" then
            -- remove the id from the end
            last.content = tslice(last.content, 1, #last.content-2)

            -- add the table to the index
            local order = indexNextOrder("tbl")
            indexAddEntry(label, nil, order, last.content)

            -- insert table caption (use \label for latex)
            prependTitlePrefix(last, label, order)

            -- wrap in a div with the label (so that we have a target
            -- for the tbl ref, in LaTeX that will be a hypertarget)
            return pandoc.Div(el, pandoc.Attr(label))
          end
        end
      end
      return el
    end
  })


end

function processMarkdownTable(divEl)
  for i,el in pairs(divEl.content) do
    if el.t == "Table" then
      if el.caption.long ~= nil then
        local caption = el.caption.long[#el.caption.long]
        local label = divEl.attr.identifier
        local order = indexNextOrder("tbl")
        indexAddEntry(label, nil, order, caption.content)
        prependTitlePrefix(caption, label, order)
        return divEl
      end
    end
  end
  return nil
end

function processRawTable(divEl)
  -- look for a raw html or latex table
  for i,el in pairs(divEl.content) do
    local rawParentEl, rawEl, rawIndex = rawElement(divEl, el, i)
    if rawEl then
      local label = divEl.attr.identifier
      -- html table
      if string.find(rawEl.format, "^html") then
        local tag = "[Cc][Aa][Pp][Tt][Ii][Oo][Nn]"
        local captionPattern = "(<" .. tag .. "[^>]*>)(.*)(</" .. tag .. ">)"
        local _, caption, _ = string.match(rawEl.text, captionPattern)
        if caption then
          local order = indexNextOrder("tbl")
          indexAddEntry(label, nil, order, stringToInlines(caption))
          local prefix = pandoc.utils.stringify(tableTitlePrefix(order))
          rawEl.text = rawEl.text:gsub(captionPattern, "%1" .. prefix .. "%2%3", 1)
          rawParentEl.content[rawIndex] = rawEl
          return divEl
        end
      -- latex table
      elseif rawEl.format == "tex" or  rawEl.format == "latex" then
        -- knitr kable latex output will already have a label w/ tab:
        -- prefix. in that case simply replace it
        local captionPattern = "\\caption{\\label{tab:" .. label .. "}([^}]+)}"
        local caption = string.match(rawEl.text, captionPattern)
        if caption then
          processLatexTable(rawEl, captionPattern, label, caption)
          rawParentEl.content[rawIndex] = rawEl
          return divEl
        end

        -- look for raw latex with a caption
        captionPattern = "\\caption{([^}]+)}"
        caption = string.match(rawEl.text, captionPattern)
        if caption then
           processLatexTable(rawEl, captionPattern, label, caption)
           rawParentEl.content[rawIndex] = rawEl
           return divEl
        end
      end
      break
    end
  end

  return nil
end

-- handle either a raw block or raw inline in first paragraph
function rawElement(divEl, el, index)
  if el.t == "RawBlock" then
    return divEl, el, index
  elseif el.t == "Para" and #el.content > 0 and el.content[1].t == "RawInline" then
    return el, el.content[1], 1
  end
end

-- is this a Div containing a table?
function isTableDiv(el)
  return el.t == "Div" and hasTableLabel(el)
end

-- does this element have a table label?
function hasTableLabel(el)
  return string.match(el.attr.identifier, "^tbl:")
end


function tableTitlePrefix(num)
  return titlePrefix("tbl", "Table", num)
end


function processLatexTable(el, captionPattern, label, caption)
  el.text = el.text:gsub(captionPattern, "\\caption{\\label{" .. label .. "}" .. caption .. "}", 1)
  local order = indexNextOrder("tbl")
  indexAddEntry(label, nil, order, stringToInlines(caption))
end

function prependTitlePrefix(caption, label, order)
  if isLatexOutput() then
     tprepend(caption.content, {
       pandoc.RawInline('latex', '\\label{' .. label .. '}')
     })
  else
     tprepend(caption.content, tableTitlePrefix(order))
  end
end

