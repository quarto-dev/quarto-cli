-- columns.lua
-- Copyright (C) 2021 by RStudio, PBC


kSideCaptionClass = 'caption-gutter'



function columns() 
  
  return {

    Div = function(el)  
      -- for any top level divs, render then
      renderDivColumn(el)
      
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
          -- table divs that aren't sub tables
          if not hasRefParent(el) then
            latexWrapEnvironment(el, latexTableEnv(el))
          end
        else
          -- other things (margin notes)
          tprepend(el.content, {latexBeginSidenote()});
          tappend(el.content, {latexEndSidenote(el)})
        end
      end   
    else 
       -- Markup any captions for the post processor
      latexMarkupCaptionEnv(el);
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

function removeColumnClasses(el)
  for i, clz in ipairs(el.attr.classes) do 
    if isColumnClass(clz) then
      el.attr.classes:remove(i)
    end
  end
end

function isColumnClass(clz) 
  if clz == undefined then
    return false
  elseif clz == 'aside' then
    return true
  elseif clz == kSideCaptionClass then
    return true
  else
    return clz:match('^column%-')
  end
end