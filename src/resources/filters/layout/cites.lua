-- columns.lua
-- Copyright (C) 2021 by RStudio, PBC
  

        -- Div w/figure ref, table ref
        -- Para that has a figure
        -- Note

-- Concept
  -- Walk blocks that could be in gutter
  -- Note
  -- Div w/column classes
  -- Div w/fig or table
  -- Para with Image (.e.g discover figure)
-- ISSUE: This is happening after the inlines are processed - does this need to be a first pass
-- where we mark the cite as resolve or something and then skip them in the inlines?
-- when already in a gutter element, just append:
-- \vspace{.1in}{?quarto-cite:<id>}



function citesPreprocess() 
  local refsInGutter = param('reference-location', 'document') == 'gutter'
  return {
    
    Note = function(note) 
      
      if isLatexOutput() and refsInGutter then
        return pandoc.walk_inline(note, {
          Inlines = walkUnresolvedCitations(function(citation, appendInline, appendAtEnd)
            appendAtEnd(citePlaceholderInline(citation))
          end)
        })
      end
    end,

    Image = function(img)
      if isLatexOutput() and hasFigureRef(img) then
        if hasGutterColumn(img) then
          -- This is a figure in the gutter itself, we need to append citations at the end of the caption
          -- without any floating
          return pandoc.walk_inline(img, {
              Inlines = walkUnresolvedCitations(function(citation, appendInline, appendAtEnd)
                appendAtEnd(citePlaceholderInlineWithProtection(citation))
              end)
            })
        elseif refsInGutter then
          -- This is a figure is in the body, but the citation should be in the margin. Use 
          -- protection to shift any citations over
          return pandoc.walk_inline(img, {
            Inlines = walkUnresolvedCitations(function(citation, appendInline, appendAtEnd)
              appendInline(marginCitePlaceholderWithProtection(citation))
            end)
          })
        end   
      end
    end,

    Div = function(div)
      if isLatexOutput() and hasTableRef(div) then 
        if #div.content > 0 and hasGutterColumn(div) or refsInGutter then

          -- inspect the table caption for refs and just mark them as resolved
          local table = div.content[1]
          if table ~= undefined and table.caption.long ~= undefined then
            local citeEls = pandoc.List()

            local captionContent = table.caption.long[1].content
            for i,inline in ipairs(captionContent) do
              if inline.t == 'Cite' then
                for j, citation in ipairs(inline.citations) do
                  -- Tables can't handle citations in captions well at all
                  -- Just mark them resolved and eat them if they're going to 
                  -- appear in the gutter
                  setResolved(citation)
                end
              end
            end
          end
        end
      end 
    end
    
  }
end

function cites() 
  return {
    -- go through inlines and resolve any unresolved citations
    Inlines = walkUnresolvedCitations(function(citation, appendInline)
      appendInline(marginCitePlaceholderInline(citation))
    end)
  }
end

function walkUnresolvedCitations(func)
  return function(inlines)
    local referenceLocation = param('reference-location', 'document')
    local modified = false
    if isLatexOutput() and referenceLocation == 'gutter'  then
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

                    dump(inlines)
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
