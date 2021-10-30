-- columns-preprocess.lua
-- Copyright (C) 2021 by RStudio, PBC

function columnsPreprocess() 
  return {
    Div = function(el)  
      if el.attr.classes:includes('cell') and not requiresPanelLayout(el) then
        -- for code chunks that arne't layout panels, forward the column classes to the output
        -- figures or tables (otherwise, the column class should be used to layout the whole panel)
        forwardColumnClasses(el)
      end      
      return el      
    end,
  }
end

-- forwwards column classes from code chunks onto their display / outputs
function forwardColumnClasses(el) 
  
  -- read the classes that should be forwarded
  local columnClasses = resolveColumnClasses(el)
  if #columnClasses > 0 then 
    noteHasColumns()

    -- Forward the column classes inside code blocks
    for i, childEl in ipairs(el.content) do 
      if childEl.attr ~= undefined and childEl.attr.classes:includes('cell-output-display') then
        -- look through the children for any figures or tables
        for j, figOrTableEl in ipairs(childEl.content) do
          
          -- forward to figure divs
          if figOrTableEl.attr ~= undefined and hasFigureRef(figOrTableEl) then
            tappend(figure.attr.classes, columnClasses)
            removeColumnClasses(el)
          end

          -- forwrd to figures
          local figure = discoverFigure(figOrTableEl, true)
          if figure ~= nil then
            tappend(figure.attr.classes, columnClasses)
            removeColumnClasses(el)
          end

          -- forward to table divs
          if figOrTableEl.t == 'Table' or (figOrTableEl.t == 'Div' and hasTableRef(figOrTableEl)) then
            tappend(figOrTableEl.attr.classes, columnClasses)
            removeColumnClasses(el)
          end
        end

      end
    end
  end         
end
