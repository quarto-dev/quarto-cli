-- columns.lua
-- Copyright (C) 2021 by RStudio, PBC

function columns() 
  
  return {

    Div = function(el)  
      if el.attr.classes:includes('cell') then
        -- for code chunks, forward the column classes to the output
        -- figures or tables
        forwardColumnClass(el)
      else
        -- for any top level divs, render then
        renderDivColumn(el)
      end
      
      return el      
    end,

    RawBlock = function(el) 
      -- Implements support for raw <aside> tags and replaces them with
      -- our raw latex representation
      if isLatexOutput() then
        if el.format == 'html' then
          if el.text == '<aside>' then 
            noteHasColumns()
            el = latexBeginSidenote()
          elseif el.text == '</aside>' then
            el = latexEndSidenote(el)
          end
        end
      end
      return el
    end
  }
end

function forwardColumnClass(el) 

  -- read the classes that should be forwarded
  local columnClasses = resolveColumnClasses(el)
  if #columnClasses > 0 then 
    noteHasColumns()

    -- Forward the column classes inside code blocks
    for i, childEl in ipairs(el.content) do 
      if childEl.attr ~= undefined and childEl.attr.classes:includes('cell-output-display') then
        -- look through the children for any figures or tables
        for j, figOrTableEl in ipairs(childEl.content) do
          -- look for figures
          local figure = discoverFigure(figOrTableEl, true)
          if figure ~= nil then
            tappend(figure.attr.classes, columnClasses)
          end

          -- forward to tables
          if figOrTableEl.t == 'Table' then
            tappend(figOrTableEl.attr.classes, columnClasses)
          end
        end

      end
    end
  end         
end

function renderDivColumn(el) 
  -- don't render this if it requires panel layout. 
  -- panel layout will take care of rendering anything special
  if isLatexOutput() and not requiresPanelLayout(el) then

    -- see if there are any column classes
    local columnClasses = resolveColumnClasses(el)
    if #columnClasses > 0 then
      noteHasColumns() 
      
      if #el.content > 0 then
        
        if hasFigureRef(el) then 
          -- figures
          latexWrapEnvironment(el, latexFigureEnv(el))
        elseif hasTableRef(el) then
          -- tables
          latexWrapEnvironment(el, latexTableEnv(el))
        else
          -- other things (margin notes)
          tprepend(el.content, {latexBeginSidenote()});
          tappend(el.content, {latexEndSidenote(el)})
        end
      end   
    end
  end
end

function noteHasColumns() 
  layoutState.hasColumns = true
end

function notColumnClass(clz) 
  return not isColumnClass(cls)
end

function resolveColumnClasses(el) 
  return el.attr.classes:filter(isColumnClass)
end

function isColumnClass(clz) 
  if clz == undefined then
    return false
  elseif clz == 'aside' then
    return true
  else
    return clz:match('^column%-')
  end
end