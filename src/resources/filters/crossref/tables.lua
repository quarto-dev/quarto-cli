-- tables.lua
-- Copyright (C) 2020 by RStudio, PBC

-- process all tables (note that cross referenced tables are *always*
-- wrapped in a div so they can carry parent information and so that
-- we can create a hyperef target for latex)
function tables()
  return {
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
  }
end

function processMarkdownTable(divEl)
  for i,el in pairs(divEl.content) do
    if el.t == "Table" then
      if el.caption.long ~= nil then
        local label = divEl.attr.identifier
        local caption = el.caption.long[#el.caption.long]
        processMarkdownTableEntry(divEl, el, label, caption)
        return divEl
      end
    end
  end
  return nil
end

function processMarkdownTableEntry(divEl, el, label, caption)
  
  -- clone the caption so we can add a clean copy to our index
  local captionClone = caption:clone()

  -- determine order / insert prefix
  local order
  local parent = divEl.attr.attributes[kRefParent]
  if (parent) then
    divEl.attr.attributes[kRefParent] = nil
    order = nextSubrefOrder()
    prependSubrefNumber(caption.content, order)
  else
    order = indexNextOrder("tbl")
    prependTitlePrefix(caption, label, order)
  end

  -- add the table to the index
  indexAddEntry(label, nil, order, caption)
  
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
          
          local order
          local prefix
          local parent = divEl.attr.attributes[kRefParent]
          if (parent) then
            divEl.attr.attributes[kRefParent] = nil
            order = nextSubrefOrder()
            local subref = pandoc.List:new()
            prependSubrefNumber(subref, order)
            prefix = inlinesToString(subref)
          else
            order = indexNextOrder("tbl")
            prefix = pandoc.utils.stringify(tableTitlePrefix(order))
          end
          
          indexAddEntry(label, nil, order, stringToInlines(caption))
        
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
          processLatexTable(divEl, rawEl, captionPattern, label, caption)
          rawParentEl.content[rawIndex] = rawEl
          return divEl
        end

        -- look for raw latex with a caption
        captionPattern = "\\caption{([^}]+)}"
        caption = string.match(rawEl.text, captionPattern)
        if caption then
           processLatexTable(divEl, rawEl, captionPattern, label, caption)
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
  return el.t == "Div" and hasTableRef(el)
end


function tableTitlePrefix(order)
  return titlePrefix("tbl", "Table", order)
end


function processLatexTable(divEl, el, captionPattern, label, caption)
  el.text = el.text:gsub(captionPattern, "\\caption{\\label{" .. label .. "}" .. caption .. "}", 1)
  
  local order
  local parent = divEl.attr.attributes[kRefParent]
  if (parent) then
    divEl.attr.attributes[kRefParent] = nil
    order = nextSubrefOrder()
  else
    order = indexNextOrder("tbl")
  end
  
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
