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
            el = beginSideNote()
          elseif el.text == '</aside>' then
            el = endSideNote()
          end
        end
      end
      return el
    end,

    Para = function(el) 
      if el.attr ~= undefined then
        local columnClasses = resolveColumnClasses(el)
        if #columnClasses > 0 then
            -- Note that we are using columns
            layoutState.hasColumns = true
        end
      end
    end
  }
end

function forwardColumnClass(el) 

  -- read the classes that should be forwarded
  local columnClasses = resolveColumnClasses(el)
  if #columnClasses > 0 then 
    -- Note that we are using columns
    layoutState.hasColumns = true

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

function renderAside(el) 
  if isLatexOutput() and #el.content > 0 then
    tprepend(el.content, {beginSideNote()})
    tappend(el.content, {endSideNote(el)})
  end
end

function renderDivColumn(el) 
  -- don't render this if it requires panel layout. 
  -- panel layout will take care of rendering anything special
  if isLatexOutput() and not requiresPanelLayout(el) then

    -- see if there are any column classes
    local columnClasses = resolveColumnClasses(el)
    if #columnClasses > 0 then
      if #el.content > 0 then
        
        if hasFigureRef(el) then 
          -- figures
          wrapContentsWithEnvironment(el, latexFigureEnv(el))
        elseif hasTableRef(el) then
          -- tables
          wrapContentsWithEnvironment(el, latexTableEnv(el))
        else
          -- other things (margin notes)
          tprepend(el.content, {beginSideNote()});
          tappend(el.content, {endSideNote(el)})
        end
      end   
    end
  end
end

function wrapContentsWithEnvironment(el, env) 
  tprepend(el.content, {latexBeginEnv(env)})
  tappend(el.content, {latexEndEnv(env)})
end

function beginSideNote() 
  return pandoc.RawBlock('latex', '\\begin{footnotesize}\\marginnote{')
end

function endSideNote(el)
  local offset = ''
  if el.attr ~= nil then
    local offsetValue = el.attr.attributes['offset']
    if offsetValue ~= nil then
      offset = '[' .. offsetValue .. ']'
    end  
  end
  return pandoc.RawBlock('latex', '}' .. offset .. '\\end{footnotesize}')
end

function notColumnClass(clz) 
  return not isColumnClass(cls)
end

function resolveColumnClasses(el) 
  local columnClasses = el.attr.classes:filter(isColumnClass)
  layoutState.hasColumns = layoutState.hasColumns or #columnClasses > 0
  return columnClasses
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