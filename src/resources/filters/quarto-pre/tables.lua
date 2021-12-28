-- tables.lua
-- Copyright (C) 2020 by RStudio, PBC


function tables() 
  
  return {
   
    Div = function(el)
      if hasTableRef(el) and tcontains(el.attr.classes, "cell") then
        local tables = countTables(el)
        -- dump(tables)
      end
    end
  }

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
    return raw.text.match(latexTablePattern) or 
           raw.text.match(latexLongtablePattern)
  else
    return false
  end
end