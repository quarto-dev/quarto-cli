-- table-captions.lua
-- Copyright (C) 2020 by RStudio, PBC

kTblCap = "tbl-cap"
kTblSubCap = "tbl-subcap"

local latexTablePattern = "(\\begin{table})(.*)(\\end{table})"
local latexLongtablePattern = "(\\begin{longtable})(.*)(\\end{longtable})"
local latexTabularPattern = "(\\begin{tabular})(.*)(\\end{tabular})"

local latexTablePatterns = pandoc.List({
  latexTablePattern,
  latexLongtablePattern,
  latexTabularPattern,
})

local latexCaptionPattern =  "(\\caption{)(.-)(}\n)"

function tableCaptions() 
  
  return {
   
    Div = function(el)
      if tcontains(el.attr.classes, "cell") then
        -- extract table attributes
        local tblCap = extractTblCapAttrib(el,kTblCap)
        local tblSubCap = extractTblCapAttrib(el, kTblSubCap, true)
        if hasTableRef(el) or tblCap then
          local tables = countTables(el)
          if tables > 0 then
           
            -- apply captions and labels if we have a tbl-cap or tbl-subcap
            if tblCap or tblSubCap then
  
              -- special case: knitr::kable will generate a \begin{tablular} without
              -- a \begin{table} wrapper -- put the wrapper in here if need be
              if isLatexOutput() then
                el = pandoc.walk_block(el, {
                  RawBlock = function(raw)
                    if isRawLatex(raw) then
                      if raw.text:match(latexTabularPattern) and not raw.text:match(latexTablePattern) then
                        raw.text = raw.text:gsub(latexTabularPattern, 
                                                "\\begin{table}\n\\centering\n%1%2%3\n\\end{table}\n",
                                                1)
                        return raw                       
                      end
                    end
                  end
                })
              end
  
              -- compute all captions and labels
              local label = el.attr.identifier
              local mainCaption, tblCaptions, mainLabel, tblLabels = tableCaptionsAndLabels(
                label,
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
    -- case: single table (no label interpolation)
    if tables == 1 then
      tblCaptions:insert(markdownToInlines(tblCap[1]))
      tblLabels:insert(label)
    -- case: single caption (apply to entire panel)
    elseif #tblCap == 1 then
      mainCaption = tblCap[1]
      mainLabel = label
    -- case: multiple tables (label interpolation)
    else
      for i=1,tables do
        if i <= #tblCap then
          tblCaptions:insert(markdownToInlines(tblCap[i]))
          if #label > 0 then
            tblLabels:insert(label .. "-" .. tostring(i))
          else
            tblLabels:insert("")
          end
        end
      end
    end
  
  -- case: subcaps
  else
    mainLabel = label
    if mainLabel == "" then
      mainLabel = anonymousTblId()
    end
    if tblCap then
      mainCaption = markdownToInlines(tblCap[1])
    else
      mainCaption = noCaption()
    end
    for i=1,tables do
      if tblSubCap and i <= #tblSubCap and tblSubCap[i] ~= "" then
        tblCaptions:insert(markdownToInlines(tblSubCap[i]))
      else
        tblCaptions:insert(pandoc.List())
      end
      if #mainLabel > 0 then
        tblLabels:insert(mainLabel .. "-" .. tostring(i))
      else
        tblLabels:insert("")
      end
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
        if #tblCaptions[idx] > 0 then
          table.caption = pandoc.List()
          tappend(table.caption, tblCaptions[idx])
          table.caption:insert(pandoc.Space())
        end
        if table.caption == nil then
          table.caption = pandoc.List()
        end
        if #tblLabels[idx] > 0 then
          tappend(table.caption, {
            pandoc.Str("{#" .. tblLabels[idx] .. "}")
          })
        end
        idx = idx + 1
        return pandoc.utils.from_simple_table(table)
      end
    end,
    RawBlock = function(raw)
      if idx <= #tblLabels then
        -- (1) if there is no caption at all then populate it from tblCaptions[idx]
        -- (assuming there is one, might not be in case of empty subcaps)
        -- (2) Append the tblLabels[idx] to whatever caption is there
        if hasRawHtmlTable(raw) then
          -- html table patterns
          local tablePattern = htmlTablePattern()
          local captionPattern = htmlTableCaptionPattern()
          -- insert caption if there is none
          local beginCaption, caption = raw.text:match(captionPattern)
          if not beginCaption then
            raw.text = raw.text:gsub(tablePattern, "%1" .. "<caption></caption>" .. "%2%3", 1)
          end
          -- apply table caption and label
          local beginCaption, captionText, endCaption = raw.text:match(captionPattern)
          if #tblCaptions[idx] > 0 then
            captionText = pandoc.utils.stringify(tblCaptions[idx])
          end
          if #tblLabels[idx] > 0 then
            captionText = captionText .. " {#" .. tblLabels[idx] .. "}"
          end
          raw.text = raw.text:gsub(captionPattern, "%1" .. captionText .. "%3", 1)
        elseif hasRawLatexTable(raw) then
          for i,pattern in ipairs(latexTablePatterns) do
            if raw.text:match(pattern) then
              raw.text = applyLatexTableCaption(raw.text, tblCaptions[idx], tblLabels[idx], pattern)
              break
            end
          end
        end
       
        idx = idx + 1
        return raw
      end
    end
  })
end


function applyLatexTableCaption(latex, tblCaption, tblLabel, tablePattern)
  -- insert caption if there is none
  local beginCaption, caption = latex:match(latexCaptionPattern)
  if not beginCaption then
    latex = latex:gsub(tablePattern, "%1" .. "\n\\caption{ }\n" .. "%2%3", 1)
  end
  -- apply table caption and label
  local beginCaption, captionText, endCaption = latex:match(latexCaptionPattern)
  if #tblCaption > 0 then
    captionText = pandoc.utils.stringify(tblCaption)
  end
  if #tblLabel > 0 then
    captionText = captionText .. " {#" .. tblLabel .. "}"
  end
  latex = latex:gsub(latexCaptionPattern, "%1" .. captionText .. "%3", 1)
  return latex
end


function extractTblCapAttrib(el, name, subcap)
  local value = attribute(el, name, nil)
  if value then
    if startsWith(value, "[") then
      value = pandoc.List(jsonDecode(value))
    elseif subcap and (value == "true") then
      value = pandoc.List({ "" })
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


function hasRawHtmlTable(raw)
  if isRawHtml(raw) and isHtmlOutput() then
    return raw.text:match(htmlTablePattern())
  else
    return false
  end
end

function hasRawLatexTable(raw)
  if isRawLatex(raw) and isLatexOutput() then
    for i,pattern in ipairs(latexTablePatterns) do
      if raw.text:match(pattern) then
        return true
      end
    end
    return false
  else
    return false
  end
end