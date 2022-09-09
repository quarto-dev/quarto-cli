


-- book.lua
-- Copyright (C) 2020 by RStudio, PBC

-- inject metadata
local kRefsIdentifier = 'refs'
local positionedBibliography = false
local bibliographies = nil

function bibliographyConfigure() 
  return {
    Meta = function(meta) 
      -- note the bibliographies that are present
      -- so subsequent filter may use this
      bibliographies = meta['bibliography']
    end
  }
end

function bibliography()
  return {
    Div = function(el)
      -- if this is a refs div 
      if el.attr.identifier == kRefsIdentifier then

        -- if we're doing biblatex or natbib, then position the bibliography
        -- here
        local citeMethod = param('cite-method', 'citeproc')
        if quarto.doc.isFormat('pdf') and citeMethod ~= 'citeproc' then
          for i, v in ipairs(bibliographies) do
            local bibliography = pandoc.RawBlock('latex', '\\bibliography{' .. v.text .. '}')
            tappend(el.content, {bibliography})
          end

          -- note that we've positioned the bibliography so
          -- we can subsequently hide this from pandoc
          positionedBibliography = true
          return el 
        end
      end
    end,
    Meta = function(meta) 
      if positionedBibliography then
        -- remove this from metadata so pandoc doesn't write it
        meta['bibliography'] = nil        
        return meta
      end
      
    end
  } 
end
