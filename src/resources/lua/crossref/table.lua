

function processTables(doc)


  filterDoc(doc, {

    Div = function(el)
      if isTableDiv(el) then
        local raw = processRawTable(el)
        if raw then
          return raw
        end

        local div = processTableDiv(el)
        if div then
          return div
        end
      end
      return el
    end,


    Table = function(el)

      if el.caption.long ~= nil then
        local last = el.caption.long[#el.caption.long]
        if #last.content > 2 then
          local lastInline = last.content[#last.content]
          local label = string.match(lastInline.text, "^{#(tbl:[^ }]+)}$")
          if label and last.content[#last.content-1].t == "Space" then
            -- remove the id from the end
            last.content = tslice(last.content, 1, #last.content-2)

            -- add the table to the index
            local order = indexNextOrder("tbl")
            indexAddEntry(label, nil, order, last.content)

            -- insert table caption (use \label for latex)
            if FORMAT == "latex" then
               tprepend(last.content, {
                 pandoc.RawInline('latex', '\\label{' .. label .. '}')
               })
            else
               tprepend(last.content, tableTitlePrefix(order))
            end

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


function processRawTable(divEl)

  -- look for a raw html or latex table
  for i,el in pairs(divEl.content) do
    if el.t == "RawBlock" then
      if string.find(el.format, "^html") then
        local tag = "[Cc][Aa][Pp][Tt][Ii][Oo][Nn]"
        local captionPattern = "(<" .. tag .. "[^>]*>)(.*)(</" .. tag .. ">)"
        if string.find(el.text, captionPattern) then
          local order = indexNextOrder("tbl")
          indexAddEntry(divEl.attr.identifier, nil, order)
          local prefix = pandoc.utils.stringify(tableTitlePrefix(order))
          el.text = el.text:gsub(captionPattern, "%1" .. prefix .. "%2%3", 1)
          divEl.content[i] = el
          return divEl
        end
      elseif el.format == "tex" or  el.format == "latex" then
        dump("found raw tex!")
      end
      break
    end
  end

  return nil

end

function processTableDiv(divEl)
  -- ensure that there is a trailing paragraph to serve as caption
  local last = divEl.content[#divEl.content]
  if last and last.t == "Para" and #divEl.content > 1 then
    local order = indexNextOrder("tbl")
    indexAddEntry(divEl.attr.identifier, nil, order)
    tprepend(last.content, tableTitlePrefix(order))
    return divEl
  else
    return nil
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


