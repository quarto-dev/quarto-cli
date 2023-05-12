-- tables.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- process all tables (note that cross referenced tables are *always*
-- wrapped in a div so they can carry parent information and so that
-- we can create a hyperef target for latex)

local patterns = require("../modules/patterns")

function crossref_tables()
  return {
    Div = function(el)
      if isTableDiv(el) and isReferenceableTbl(el) then
        
        -- are we a parent of subrefs? If so then process the caption
        -- at the bottom of the div
        if hasSubRefs(el, "tbl") then
          
          local caption = refCaptionFromDiv(el)
          if not caption then
            caption = pandoc.Para(noCaption())
            el.content:insert(caption)
          end
          local captionClone = caption:clone().content
          local label = el.attr.identifier
          local order = indexNextOrder("tbl")
          prependTitlePrefix(caption, label, order)
          indexAddEntry(label, nil, order, captionClone)
          
        else
          -- look for various ways of expressing tables in a div
          local processors = { processMarkdownTable, processRawTable }
          for _, process in ipairs(processors) do
            local tblDiv = process(el)
            if tblDiv then
              return tblDiv
            end
          end
        end
      end
      -- default to just reflecting the div back
      return el
    end
  }
end

function preprocessRawTableBlock(rawEl, parentId)
  
  local function divWrap(el, label, caption)
    local div = pandoc.Div(el, pandoc.Attr(label))
    if parentId then
      div.attr.attributes[kRefParent] = parentId
      if caption then
        div.content:insert(pandoc.Para(stringToInlines(caption)))
      end
    end
    return div
  end
  
  if _quarto.format.isRawHtml(rawEl) and _quarto.format.isHtmlOutput() then
    local captionPattern = patterns.html_table_caption
    local _, caption, _ = string.match(rawEl.text, captionPattern) 
    if caption then
      -- extract id if there is one
      local caption, label = extractRefLabel("tbl", caption)
      if label then
        -- remove label from caption
        rawEl.text = rawEl.text:gsub(captionPattern, "%1" .. caption:gsub("%%", "%%%%") .. "%3", 1)
      elseif parentId then
        label = autoRefLabel(parentId)
      end
        
      if label then
        return divWrap(rawEl, label)
      end
    end
  elseif _quarto.format.isRawLatex(rawEl) and _quarto.format.isLatexOutput() then
    
    -- remove knitr label
    local knitrLabelPattern = "\\label{tab:[^}]+} ?"
    rawEl.text = rawEl.text:gsub(knitrLabelPattern, "", 1)
    
    -- try to find a caption with an id
    local captionPattern = "(\\caption{)(.*)" .. refLabelPattern("tbl") .. "([^}]*})"
    local _, caption, label, _ = rawEl.text:match(captionPattern)
    if label then
      -- remove label from caption
      rawEl.text = rawEl.text:gsub(captionPattern, "%1%2%4", 1)
    elseif parentId then
      label = autoRefLabel(parentId)
    end
      
    if label then
      return divWrap(rawEl, label)
    end
      
  end
  
  return rawEl
  
end

function preprocessTable(el, parentId)
  
 -- if there is a caption then check it for a table suffix
  if el.caption.long ~= nil then
    local last = el.caption.long[#el.caption.long]
    if last and #last.content > 0 then
       -- check for tbl label
      local label = nil
      local caption, attr = parseTableCaption(last.content)
      if startsWith(attr.identifier, "tbl-") then
        -- set the label and remove it from the caption
        label = attr.identifier
        attr.identifier = ""
        last.content = createTableCaption(caption, attr)
   
        -- provide error caption if there is none
        if #last.content == 0 then
          if parentId then
            tappend(last.content, { emptyCaption() })
          else
            tappend(last.content, { noCaption() })
          end
        end
        
      -- if there is a parent then auto-assign a label if there is none 
      elseif parentId then
        label = autoRefLabel(parentId)
      end
     
      if label then
        -- wrap in a div with the label (so that we have a target
        -- for the tbl ref, in LaTeX that will be a hypertarget)
        local div = pandoc.Div(el, pandoc.Attr(label))
        
        -- propagate parent id if the parent is a table
        if parentId and isTableRef(parentId) then
          div.attr.attributes[kRefParent] = parentId
        end
        
        -- return the div
        return div
      end
    end
  end
  return el
end


function processMarkdownTable(divEl)
  for i,el in pairs(divEl.content) do
    if el.t == "Table" then
      if el.caption.long ~= nil and #el.caption.long > 0 then
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
  local captionClone = caption.content:clone()

  -- determine order / insert prefix
  local order
  local parent = divEl.attr.attributes[kRefParent]
  if (parent) then
    order = nextSubrefOrder()
    prependSubrefNumber(caption.content, order)
  else
    order = indexNextOrder("tbl")
    prependTitlePrefix(caption, label, order)
  end

  -- add the table to the index
  indexAddEntry(label, parent, order, captionClone)
  
end



function processRawTable(divEl)
  -- look for a raw html or latex table
  for i,el in pairs(divEl.content) do
    local rawParentEl, rawEl, rawIndex = rawElement(divEl, el, i)
    if rawEl then
      local label = divEl.attr.identifier
      -- html table
      if _quarto.format.isRawHtml(rawEl) then
        local captionPattern = patterns.html_table_caption()
        local _, caption, _ = string.match(rawEl.text, captionPattern)
        if caption then
          
          local order
          local prefix
          local parent = divEl.attr.attributes[kRefParent]
          if (parent) then
            order = nextSubrefOrder()
            local subref = pandoc.List()
            prependSubrefNumber(subref, order)
            prefix = inlinesToString(subref)
          else
            order = indexNextOrder("tbl")
            prefix = pandoc.utils.stringify(tableTitlePrefix(order))
          end
          
          indexAddEntry(label, parent, order, stringToInlines(caption))
        
          rawEl.text = rawEl.text:gsub(captionPattern, "%1" .. prefix .. " %2%3", 1)
          rawParentEl.content[rawIndex] = rawEl
          return divEl
        end
      -- latex table
      elseif _quarto.format.isRawLatex(rawEl) then
        
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
  
  local order
  local parent = divEl.attr.attributes[kRefParent]
  if (parent) then
    el.text = el.text:gsub(captionPattern, "", 1)
    divEl.content:insert(pandoc.Para(stringToInlines(caption)))
    order = nextSubrefOrder()
  else
    el.text = el.text:gsub(captionPattern, "\\caption{\\label{" .. label .. "}" .. caption:gsub("%%", "%%%%") .. "}", 1)
    order = indexNextOrder("tbl")
  end
  
  indexAddEntry(label, parent, order, stringToInlines(caption))
end

function prependTitlePrefix(caption, label, order)
  if _quarto.format.isLatexOutput() then
     tprepend(caption.content, {
       pandoc.RawInline('latex', '\\label{' .. label .. '}')
     })
  elseif not _quarto.format.isAsciiDocOutput() then
     tprepend(caption.content, tableTitlePrefix(order))
  end
end


