-- table-captions.lua
-- Copyright (C) 2020 by RStudio, PBC

kTblCap = "tbl-cap"
kTblSubCap = "tbl-subcap"

local latexCaptionPattern =  "(\\caption{)(.-)(}[^\n]*\n)"

function knitrNoTable(text)
  if text:match(_quarto.patterns.latexTablePattern) then
    return false
  end
  for i, pattern in ipairs(_quarto.patterns.latexTabularPatterns) do
    if text:match(pattern) then
      return pattern
    end
  end
  for i, pattern in ipairs(_quarto.patterns.latexLongTablePatterns) do
    if text:match(pattern) then
      return pattern
    end
  end
  return false
end

local formatTableCapLocation

function getTableCapLocationFromAttrs(el)
  if tcontains(el.attr.classes, "tbl-cap-location-bottom") then
    return "bottom"
  elseif tcontains(el.attr.classes, "tbl-cap-location-top") then
    return "bottom"
  elseif tcontains(el.attr.classes, "tbl-cap-location-margin") then
    return "margin"
  else
    return nil
  end  
end

function getTableCapLocation(el)
  return getTableCapLocationFromAttrs(el) or formatTableCapLocation or "top"
end 

function tableCaptions() 
  
  return {
    Meta = function(meta)
      formatTableCapLocation = meta['tbl-cap-location']
    end,
   
    Div = function(el)
      if tcontains(el.attr.classes, "cell") then
        -- extract table attributes

        local tables = countTables(el)

        if tables > 0 then
          local tblCap = extractTblCapAttrib(el,kTblCap)
          local tblSubCap = extractTblCapAttrib(el, kTblSubCap, true)
          
          local someTableHadEmbeddedCaptions = false

          -- tables might come with their own caption, so we need to check them all
          -- special case: knitr::kable will generate a \begin{tabular} without
          -- a \begin{table} wrapper -- put the wrapper in here if need be
          if _quarto.format.isLatexOutput() then
            el = pandoc.walk_block(el, {
              RawBlock = function(raw)
                if _quarto.format.isRawLatex(raw) then
                  someTableHadEmbeddedCaptions = someTableHadEmbeddedCaptions or raw.text:match(latexCaptionPattern)
                  local noTablePattern = knitrNoTable(raw.text)
                  if noTablePattern then
                    raw.text = raw.text:gsub(noTablePattern,
                                            "\\begin{table}[h]\n\\centering\n%1%2%3\n\\end{table}\n",
                                            1)
                    return raw                       
                  end
                end
              end
            })
          end
          
          if tblCap or tblSubcap or someTableHadEmbeddedCaptions then
            -- compute all captions and labels
            local label = el.attr.identifier
            local mainCaption, tblCaptions, mainLabel, tblLabels = tableCaptionsAndLabels(
              label,
              tables,
              tblCap,
              tblSubCap,
              someTableHadEmbeddedCaptions
            )              
            if someTableHadEmbeddedCaptions then
              el = fixupEmbeddedCaptionTables(el)
            end

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

-- we can't really just search for the next matching brace here
-- because many captions will have nested braces.
function findCaption(text)
  local b, e = text:find("\\caption{")
  if b == nil then
    return nil
  end
  local count = 1
  for i=e+1,text:len(text) do
    local c = text:sub(i, i)
    if c == "{" then
      count = count + 1
    elseif c == "}" then
      count = count - 1
    end
    if count == 0 then
      -- we know that knitr inserts a \\ line break; let's take that with us
      return b, i+2, text:sub(b, i+2)
    end
  end
  return nil
end

function fixupEmbeddedCaptionTables(el)
  local loc = getTableCapLocation(el)
  return pandoc.walk_block(el, {
    RawBlock = function(raw)
      if _quarto.format.isRawLatex(raw) and raw.text:match(latexCaptionPattern) and loc == "bottom" then
        local capStart, capEnd, cap = findCaption(raw.text)
        -- if caption couldn't be found, don't fixup.
        if capStart == nil then
          return
        end

        local patterns = {
          "(\\end{tabular})",
          "(\\end{longtable})"
        }
        
        for _, pattern in pairs(patterns) do
          local b, e = raw.text:find(pattern)
          if b ~= nil then
            raw.text = (raw.text:sub(1, capStart - 1) .. 
              raw.text:sub(capEnd + 1, b - 1) ..
              cap:sub(1, cap:len() - 2) ..
              raw.text:sub(b, raw.text:len()))
            print("PATCH")
            print(raw.text)
            return raw
          end
        end
      end
    end
  })
end

function tableCaptionsAndLabels(label, tables, tblCap, tblSubCap, someTableHadEmbeddedCaptions)
  
  local mainCaption = nil
  local tblCaptions = pandoc.List()
  local mainLabel = ""
  local tblLabels = pandoc.List()

  -- case: no subcaps (no main caption or label, apply caption(s) to tables)
  if not tblSubCap and not someTableHadEmbeddedCaptions then
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
  elseif tblSubCap then
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
  else
    -- case: embedded captions. This came from knitr. Let's just put the caption in the right place.
    
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
          raw.text = raw.text:gsub(captionPattern, "%1" .. captionText:gsub("%%", "%%%%") .. "%3", 1)
        elseif hasRawLatexTable(raw) then
          for i,pattern in ipairs(_quarto.patterns.latexTablePatterns) do
            if raw.text:match(pattern) then
              raw.text = applyLatexTableCaption(raw.text, tblCaptions[idx], tblLabels[idx], pattern)
              break
            end
          end
        elseif hasPagedHtmlTable(raw) then
          if #tblCaptions[idx] > 0 then
            local captionText = pandoc.utils.stringify(tblCaptions[idx])
            if #tblLabels[idx] > 0 then
              captionText = captionText .. " {#" .. tblLabels[idx] .. "}"
            end
            local pattern = "(<div data[-]pagedtable=\"false\">)"
            -- we don't have a table to insert a caption to, so we'll wrap the caption with a div and the right class instead
            local replacement = "%1 <div class=\"table-caption\"><caption>" .. captionText:gsub("%%", "%%%%") .. "</caption></div>"
            raw.text = raw.text:gsub(pattern, replacement)
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
    latex = latex:gsub(tablePattern, "%1" .. "\n\\caption{ }\\tabularnewline\n" .. "%2%3", 1)
  end
  -- apply table caption and label
  local beginCaption, captionText, endCaption = latex:match(latexCaptionPattern)
  if #tblCaption > 0 then
    captionText = pandoc.utils.stringify(tblCaption)
  end
  -- escape special characters for LaTeX
  captionText = stringEscape(captionText, "latex")
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
