-- tables.lua
-- Copyright (C) 2020 by RStudio, PBC

kTblCap = "tbl-cap"
kTblSubCap = "tbl-subcap"

function tables() 
  
  return {
   
    Div = function(el)
      if hasTableRef(el) and tcontains(el.attr.classes, "cell") then
        local tables = countTables(el)
        if tables > 0 then
          -- extract table attributes
          local tblCap = extractTblCapAttrib(el,kTblCap)
          local tblSubCap = extractTblCapAttrib(el, kTblSubCap)
          -- apply captions and labels if we have a tbl-cap or tbl-subcap
          if tblCap or tblSubCap then
            -- compute all captions and labels
            local mainCaption, tblCaptions, mainLabel, tblLabels = tableCaptionsAndLabels(
              el.attr.identifier,
              tables,
              tblCap,
              tblSubCap
            )
            -- apply captions and label
            el.attr.identifier = mainLabel
            if mainCaption then
              el.content:insert(pandoc.Para(mainCaption))
            end
            if #tblCaptions > 0 then
              el = applyTableCaptions(el, tblCaptions, tblLabels)
            end
            return el
          end
        end
      end
    end
  }

end

function tableCaptionsAndLabels(label, tables, tblCap, tblSubCap)
  
  local mainCaption = nil
  local tblCaptions = pandoc.List()
  local mainLabel = ""
  local tblLabels = pandoc.List()

  -- case: no subcaps (no main caption or label, apply caption(s) to tables)
  if not tblSubCap then
    -- case: single caption (apply to entire panel)
    if #tblCap == 1 then
      mainCaption = tblCap[1]
      mainLabel = label
    -- case: single table (no label interpolation)
    elseif tables == 1 then
      tblCaptions:insert(markdownToInlines(tblCap[1]))
      tblLabels:insert(label)
    -- case: multiple tables (label interpolation)
    else
      for i=1,tables do
        if i <= #tblCap then
          tblCaptions:insert(markdownToInlines(tblCap[i]))
          tblLabels:insert(label .. "-" .. tostring(i))
        end
      end
    end
  
  -- case: subcaps
  else
    mainLabel = label
    if tblCap then
      mainCaption = markdownToInlines(tblCap[1])
    else
      mainCaption = noCaption()
    end
    for i=1,tables do
      if tblSubCap and i <= #tblSubCap and tblSubCap[i] ~= "" then
        tblCaptions:insert(markdownToInlines(tblSubCap[i]))
      else
        tblCaptions:insert(pandoc.List( { pandoc.Space() } ))
      end
      tblLabels:insert(label .. "-" .. tostring(i))
    end
  end

  return mainCaption, tblCaptions, mainLabel, tblLabels

end

function applyTableCaptions(el, tblCaptions, tblLabels)
  local idx = 1
  return pandoc.walk_block(el, {
    Table = function(table)
      if idx <= #tblLabels then
        table = pandoc.utils.to_simple_table(table)
        if tblCaptions[idx] ~= nil then
          table.caption = pandoc.List()
          tappend(table.caption, tblCaptions[idx])
          table.caption:insert(pandoc.Space())
        end
        if table.caption == nil then
          table.caption = pandoc.List()
        end
        tappend(table.caption, {
          pandoc.Str("{#" .. tblLabels[idx] .. "}")
        })
        idx = idx + 1
        return pandoc.utils.from_simple_table(table)
      end
    end,
    RawBlock = function(raw)
      if idx <= #tblLabels then
        -- (1) if there is no caption at all then populate it from tblCaptions[idx]
        -- (assuming there is one, might not be in case of empty subcaps)
        -- (2) Append the tblLabels[idx] to whatever caption is there
        idx = idx + 1
        return raw
      end
    end
  })
end

function extractTblCapAttrib(el, name)
  local value = attribute(el, name, nil)
  if value then
    if startsWith(value, "[") then
      value = pandoc.List(jsonDecode(value))
    else
      value = pandoc.List({ value })
    end
    el.attr.attributes[name] = nil
    return value
  end
  return nil
end

function countTables(div)
  local tables = 0
  pandoc.walk_block(div, {
    Table = function(table)
      tables = tables + 1
    end,
    RawBlock = function(raw)
      if hasRawHtmlTable(raw) or hasRawLatexTable(raw) then
        tables = tables + 1
      end
    end
  })
  return tables
end

local tableTag = "[Tt][Aa][Bb][Ll][Ee]"
local htmlTablePattern = "(<" .. tableTag .. "[^>]*>)(.*)(</" .. tableTag .. ">)"

function hasRawHtmlTable(raw)
  if isRawHtml(raw) and isHtmlOutput() then
    return raw.text:match(htmlTablePattern)
  else
    return false
  end
end

local latexTablePattern = "\\begin{tabular}"
local latexLongtablePattern = "\\begin{longtable}"

function hasRawLatexTable(raw)
  if isRawLatex(raw) and isLatexOutput() then
    return raw.text:match(latexTablePattern) or 
           raw.text:match(latexLongtablePattern)
  else
    return false
  end
end