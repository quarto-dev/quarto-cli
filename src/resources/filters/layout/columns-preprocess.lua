-- columns-preprocess.lua
-- Copyright (C) 2021 by RStudio, PBC

function columnsPreprocess() 
  return {
    Div = function(el)  
      
      if el.attr.classes:includes('cell') then      
        -- for code chunks that aren't layout panels, forward the column classes to the output
        -- figures or tables (otherwise, the column class should be used to layout the whole panel)
        resolveColumnClassesForCodeCell(el)
      else
        resolveColumnClassesForEl(el)
      end      
      return el      
    end,

    Para = function(el)
      local figure = discoverFigure(el)
      if figure then
        resolveColumnClassesForEl(figure)
      end
      return el
    end  
  }
end

-- resolves column classes for an element
function resolveColumnClassesForEl(el) 
  -- ignore sub figures and sub tables
  if not hasRefParent(el) then    
    if hasFigureRef(el) then
      resolveElementForScopedColumns(el, 'fig')
    elseif hasTableRef(el) then
      resolveElementForScopedColumns(el, 'tbl')
    end
  end
end

-- forwwards column classes from code chunks onto their display / outputs
function resolveColumnClassesForCodeCell(el) 

  -- read the classes that should be forwarded
  local columnClasses = resolveColumnClasses(el)
  local tblClasses = resolveScopedColumnClasses(el, 'tbl')
  local figClasses = resolveScopedColumnClasses(el, 'fig')  


  if #columnClasses > 0 or #tblClasses > 0 or #figClasses > 0 then 
    noteHasColumns()
    
    if hasLayoutAttributes(el) then
      -- This is a panel, don't resolve any internal classes, only resolve 
      -- actually column classes for this element itself
      resolveColumnClassesForEl(el)
    else
      -- Forward the column classes inside code blocks
      for i, childEl in ipairs(el.content) do 
        if childEl.attr ~= undefined and childEl.attr.classes:includes('cell-output-display') then

          -- look through the children for any figures or tables
          for j, figOrTableEl in ipairs(childEl.content) do

            -- forward to figure divs
            if figOrTableEl.attr ~= undefined and hasFigureRef(figOrTableEl) then
              if #figClasses > 0 then
                removeColumnClasses(figure)
                tappend(figure.attr.classes, figClasses)
                removeScopedColumnClasses(el, 'fig')
              else
                tappend(figure.attr.classes, classes)
                removeColumnClasses(el)
              end
            end

            -- forward to figures
            local figure = discoverFigure(figOrTableEl, true)
            if figure ~= nil then
              if #figClasses > 0 then
                removeColumnClasses(figure)
                tappend(figure.attr.classes, figClasses)
                removeScopedColumnClasses(el, 'fig')
              else
                tappend(figure.attr.classes, classes)
                removeColumnClasses(el)
              end
            end

            -- forward to table divs
            if figOrTableEl.t == 'Table' or (figOrTableEl.t == 'Div' and hasTableRef(figOrTableEl)) then
              if #tblClasses > 0 then
                removeColumnClasses(figOrTableEl)
                tappend(figOrTableEl.attr.classes, tblClasses)
                removeScopedColumnClasses(el, 'tbl')
              else
                tappend(figOrTableEl.attr.classes, columnClasses)
                removeColumnClasses(el)
              end
            end
          end
        end
      end

    end
  end         
end

-- processes an element and resolves column classes for a
-- given scope
function resolveElementForScopedColumns(el, scope) 
  -- tables
  local classes = resolveScopedColumnClasses(el, scope)
  if #classes > 0 then
    noteHasColumns()
    removeScopedColumnClasses(el, scope)
    tappend(el.attr.classes, classes)
  end
end

function resolveScopedColumnClasses(el, scope)
  local filtered = el.attr.classes:filter(function(clz)
    return clz:match('^' .. scope .. '%-column%-')
  end)
  if #filtered > 0 then
    return tmap(filtered, function(clz)
      return clz:sub(5)
    end)
  else
    return scopedColumnClassesOption(scope)
  end
end

function removeScopedColumnClasses(el, scope) 
  for i, clz in ipairs(el.attr.classes) do 
    if clz:match('^' .. scope .. '%-column%-') then
      el.attr.classes:remove(i)
    end
  end
end

function scopedColumnClassesOption(scope) 
  local clz = option(scope .. '-column', nil);
  if clz == nil then
    clz = option('column',  nil)
  end
  local column = columnToClass(clz)
  if column then
    return {column}
  else
    return {}
  end
end