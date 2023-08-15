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

    FloatCrossref = function(float)
      local inlines_filter
      local has_margin_column = hasMarginColumn(float)

      -- general figure caption cites fixups
      -- FIXME check parenthesization
      if _quarto.format.isLatexOutput() and has_margin_column or hasMarginCaption(float) then
        -- This is a figure in the margin itself, we need to append citations at the end of the caption
        -- without any floating
        inlines_filter = walkUnresolvedCitations(function(citation, appendInline, appendAtEnd)
          appendAtEnd(citePlaceholderInlineWithProtection(citation))
        end)
      elseif marginCitations() then
        -- This is a figure is in the body, but the citation should be in the margin. Use 
        -- protection to shift any citations over
        inlines_filter = walkUnresolvedCitations(function(citation, appendInline, appendAtEnd)
          appendInline(marginCitePlaceholderInlineWithProtection(citation))
        end)
      end
      if inlines_filter then
        float.caption_long = _quarto.ast.walk(float.caption_long, {
          Inlines = inlines_filter
        })
      end

      -- table caption cites fixups
      -- FIXME check parenthesization
      if refType(float.identifier) == 'tbl' and _quarto.format.isLatexOutput() and hasMarginColumn(float) or marginCitations() then
        local ref_table
        _quarto.ast.walk(float.content, {
          Table = function(t)
            ref_table = t
          end
        })       
        if ref_table ~= nil then
          -- we don't want to update this inside the float.content walk above
          -- because the caption_long is part of the content and that
          -- will cause weirdness
          float.caption_long = _quarto.ast.walk(float.caption_long, {
            Inlines = function(inlines)
              return resolveCaptionCitations(inlines, has_margin_column)
            end
          })
        end
      end

      return float
    end,

    Para = function(para)
      local figure = discoverFigure(para, true)
      if figure and _quarto.format.isLatexOutput() and hasFigureRef(figure) then
        fail("Should not have arrived here given new float crossref")
      end
    end,

    Div = function(div)
      -- FIXME check parenthesization
      if _quarto.format.isLatexOutput() and hasMarginColumn(div) or marginCitations() then
        if hasTableRef(div) then 
          -- inspect the table caption for refs and just mark them as resolved
          local table = discoverTable(div)
          if table ~= nil and table.caption ~= nil and table.caption.long ~= nil then
            fail("Should not have arrived here given new float crossref")
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
    Inlines = function(inlines)
      return (walkUnresolvedCitations(function(citation, appendInline)
        appendInline(marginCitePlaceholderInline(citation))
      end)(inlines))
    end
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
