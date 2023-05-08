-- cites.lua
-- Copyright (C) 2021-2022 Posit Software, PBC
  

function cites_preprocess()
  -- FIXME do we need parentheses here?
  if not _quarto.format.isLatexOutput() and marginCitations() then
    return { }
  end

  return {
    
    Note = function(note) 
      if _quarto.format.isLatexOutput() and marginCitations() then
        return _quarto.ast.walk(note, {
          Inlines = walkUnresolvedCitations(function(citation, appendInline, appendAtEnd)
            appendAtEnd(citePlaceholderInline(citation))
          end)
        })
      end
    end,

    Para = function(para)
      local figure = discoverFigure(para, true)
      if figure and _quarto.format.isLatexOutput() and hasFigureRef(figure) then
        if hasMarginColumn(figure) or hasMarginCaption(figure) then
          -- This is a figure in the margin itself, we need to append citations at the end of the caption
          -- without any floating
          para.content[1] = _quarto.ast.walk(figure, {
              Inlines = walkUnresolvedCitations(function(citation, appendInline, appendAtEnd)
                appendAtEnd(citePlaceholderInlineWithProtection(citation))
              end)
            })
          return para
        elseif marginCitations() then
          -- This is a figure is in the body, but the citation should be in the margin. Use 
          -- protection to shift any citations over
          para.content[1] = _quarto.ast.walk(figure, {
            Inlines = walkUnresolvedCitations(function(citation, appendInline, appendAtEnd)
              appendInline(marginCitePlaceholderWithProtection(citation))
            end)
          })
          return para
        end   
      end
    end,

    Div = function(div)
      if _quarto.format.isLatexOutput() and hasMarginColumn(div) or marginCitations() then
        if hasTableRef(div) then 
          -- inspect the table caption for refs and just mark them as resolved
          local table = discoverTable(div)
          if table ~= nil and table.caption ~= nil and table.caption.long ~= nil then
            local cites = false
            -- go through any captions and resolve citations into latex
            for i, caption in ipairs(table.caption.long) do
              cites = resolveCaptionCitations(caption.content, hasMarginColumn(div)) or cites
            end
            if cites then
              return div
            end
          end  
        else
          return _quarto.ast.walk(div, {
            Inlines = walkUnresolvedCitations(function(citation, appendInline, appendAtEnd)
              if hasMarginColumn(div) then
                appendAtEnd(citePlaceholderInline(citation))
              end
            end)
          })
        end 

      end
    end
    
  }
end

function cites()
  if not (_quarto.format.isLatexOutput() and marginCitations()) then
    return { }
  end

  return {
    -- go through inlines and resolve any unresolved citations
    Inlines = walkUnresolvedCitations(function(citation, appendInline)
      appendInline(marginCitePlaceholderInline(citation))
    end)
  }
end

function walkUnresolvedCitations(func)
  return function(inlines)
    local modified = false
    if _quarto.format.isLatexOutput() and marginCitations() then
      for i,inline in ipairs(inlines) do
        if inline.t == 'Cite' then
          for j, citation in ipairs(inline.citations) do
            if not isResolved(citation) then
              func(
                citation, 
                function(inlineToAppend)
                  if inlineToAppend ~= nil then
                    local inlinePos = i
                    local citationCount = j                  
                    inlines:insert(inlinePos+citationCount, inlineToAppend)
                    modified = true
                    setResolved(citation)
                  end
                end,
                function(inlineToAppendAtEnd)
                  if inlineToAppendAtEnd ~= nil then
                    inlines:insert(#inlines + 1, inlineToAppendAtEnd)
                    modified = true
                    setResolved(citation)
                  end
                end
            )
            end  
          end
        end
      end
    end
    if modified then
      return inlines  
    end    
  end
end

function resolveCaptionCitations(captionContentInlines, inMargin)
  local citeEls = pandoc.List()
  for i,inline in ipairs(captionContentInlines) do
    if inline.t == 'Cite' then
      for j, citation in ipairs(inline.citations) do
        if inMargin then
          citeEls:insert(citePlaceholderInlineWithProtection(citation))
        else
          citeEls:insert(marginCitePlaceholderWithProtection(citation))
        end
        setResolved(citation)
      end
    end
  end

  if #citeEls > 0 then
    tappend(captionContentInlines, citeEls)
    return true
  else
    return false
  end
end

function marginCitePlaceholderInline(citation)
  return pandoc.RawInline('latex', '\\marginpar{\\begin{footnotesize}{?quarto-cite:'.. citation.id .. '}\\vspace{2mm}\\par\\end{footnotesize}}')
end

function citePlaceholderInline(citation)
  return pandoc.RawInline('latex', '\\linebreak\\linebreak{?quarto-cite:'.. citation.id .. '}\\linebreak')
end

function citePlaceholderInlineWithProtection(citation)
  return pandoc.RawInline('latex', '\\linebreak\\linebreak\\protect{?quarto-cite:'.. citation.id .. '}\\linebreak')
end

function marginCitePlaceholderWithProtection(citation)
  return pandoc.RawInline('latex', '\\protect\\marginnote{\\begin{footnotesize}\\protect{?quarto-cite:'.. citation.id .. '}\\linebreak\\end{footnotesize}}')
end

local resolvedCites = {}

function keyForCite(citation) 
  local id = citation.id
  local num = citation.note_num
  local key = id .. num
  return key
end

-- need a way to communicate that this has been resolved
function setResolved(citation)
  resolvedCites[keyForCite(citation)] = true
end

function isResolved(citation)
  return resolvedCites[keyForCite(citation)] == true
end

function discoverTable(div) 
  local tbl = div.content[1]
  if tbl.t == 'Table' then
    return tbl
  else
    return nil
  end
end
