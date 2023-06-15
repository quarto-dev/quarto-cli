-- table-captions.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

local patterns = require("modules/patterns")

kTblCap = "tbl-cap"
kTblSubCap = "tbl-subcap"

function longtable_no_caption_fixup()
  return {
    RawBlock = function(raw)
      if _quarto.format.isRawLatex(raw) then
        if (raw.text:match(_quarto.patterns.latexLongtablePattern) and
            not raw.text:match(_quarto.patterns.latexCaptionPattern)) then
          raw.text = raw.text:gsub(
            _quarto.patterns.latexLongtablePattern, "\\begin{longtable*}%2\\end{longtable*}", 1)
          return raw
        end
      end
    end
  }
end

function table_captions() 
  return {   
    Div = function(el)
      if tcontains(el.attr.classes, "cell") then
        print("before")
        print(el)
        print()
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
              if _quarto.format.isLatexOutput() then
                el = _quarto.ast.walk(el, {
                  RawBlock = function(raw)
                    if _quarto.format.isRawLatex(raw) then
                      if raw.text:match(_quarto.patterns.latexTabularPattern) and not raw.text:match(_quarto.patterns.latexTablePattern) then
                        raw.text = raw.text:gsub(_quarto.patterns.latexTabularPattern, 
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
              local mainCaption, tblCaptions, mainLabel, tblLabels = table_captionsAndLabels(
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
              print("after")
              print(el)
              return el
            end
          end
        end
      end
      
      
    end
  }

end

function table_captionsAndLabels(label, tables, tblCap, tblSubCap)
  
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
  return _quarto.ast.walk(el, {
    Table = function(el)
      if idx <= #tblLabels then
        local cap = pandoc.Inlines({})
        if #tblCaptions[idx] > 0 then
          cap:extend(tblCaptions[idx])
          cap:insert(pandoc.Space())
        end
        if #tblLabels[idx] > 0 then
          cap:insert(pandoc.Str("{#" .. tblLabels[idx] .. "}"))
        end
        idx = idx + 1
        el.caption.long = pandoc.Plain(cap)
        return el
      end
    end,
    RawBlock = function(raw)
      if idx <= #tblLabels then
        -- (1) if there is no caption at all then populate it from tblCaptions[idx]
        -- (assuming there is one, might not be in case of empty subcaps)
        -- (2) Append the tblLabels[idx] to whatever caption is there
        if hasRawHtmlTable(raw) then
          -- html table patterns
          local tablePattern = patterns.html_table
          local captionPattern = patterns.html_table_caption
          -- insert caption if there is none
          local beginCaption, caption = raw.text:match(captionPattern)
          if not beginCaption then
            raw.text = raw.text:gsub(tablePattern, "%1" .. "<caption></caption>" .. "%2%3", 1)
          end
          -- apply table caption and label
          local beginCaption, captionText, endCaption = raw.text:match(captionPattern)
          if #tblCaptions[idx] > 0 then
            captionText = stringEscape(tblCaptions[idx], "html")
          end
          if #tblLabels[idx] > 0 then
            captionText = captionText .. " {#" .. tblLabels[idx] .. "}"
          end
          raw.text = raw.text:gsub(captionPattern, "%1" .. captionText:gsub("%%", "%%%%") .. "%3", 1)
          idx = idx + 1
        elseif hasRawLatexTable(raw) then
          for i,pattern in ipairs(_quarto.patterns.latexTablePatterns) do
            if raw.text:match(pattern) then
              raw.text = applyLatexTableCaption(raw.text, tblCaptions[idx], tblLabels[idx], pattern)
              break
            end
          end
          idx = idx + 1
        elseif hasPagedHtmlTable(raw) then
          if #tblCaptions[idx] > 0 then
            local captionText = stringEscape(tblCaptions[idx], "html")
            if #tblLabels[idx] > 0 then
              captionText = captionText .. " {#" .. tblLabels[idx] .. "}"
            end
            local pattern = "(<div data[-]pagedtable=\"false\">)"
            -- we don't have a table to insert a caption to, so we'll wrap the caption with a div and the right class instead
            local replacement = "%1 <div class=\"table-caption\"><caption>" .. captionText:gsub("%%", "%%%%") .. "</caption></div>"
            raw.text = raw.text:gsub(pattern, replacement)
          end
          idx = idx + 1
        end
       
        return raw
      end
    end
  })
end


function applyLatexTableCaption(latex, tblCaption, tblLabel, tablePattern)
  local latexCaptionPattern = _quarto.patterns.latexCaptionPattern
  -- insert caption if there is none
  local beginCaption, caption = latex:match(latexCaptionPattern)
  if not beginCaption then
    latex = latex:gsub(tablePattern, "%1" .. "\n\\caption{ }\\tabularnewline\n" .. "%2%3", 1)
  end
  -- apply table caption and label
  local beginCaption, captionText, endCaption = latex:match(latexCaptionPattern)
  if #tblCaption > 0 then
    captionText = stringEscape(tblCaption, "latex")
  end
  if #tblLabel > 0 then
    captionText = captionText .. " {#" .. tblLabel .. "}"
  end
  latex = latex:gsub(latexCaptionPattern, "%1" .. captionText:gsub("%%", "%%%%") .. "%3", 1)
  return latex
end


function extractTblCapAttrib(el, name, subcap)
  local value = attribute(el, name, nil)
  if value then
    if startsWith(value, "[") then
      value = pandoc.List(quarto.json.decode(value))
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
