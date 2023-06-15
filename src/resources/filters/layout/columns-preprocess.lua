-- columns-preprocess.lua
-- Copyright (C) 2021-2022 Posit Software, PBC

function columns_preprocess() 
  return {
    FloatCrossref = function(float)
      local location = cap_location(float)
      if location == 'margin' then
        float.classes:insert('margin-caption')
        noteHasColumns()
        return float
      end
    end,

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
      local figure = discoverFigure(el, false)
      if figure then
        resolveElementForScopedColumns(figure, 'fig')
      end
      return el
    end  
  }
end

-- resolves column classes for an element
function resolveColumnClassesForEl(el)
  if not hasRefParent(el) then
    if hasFigureRef(el) then
      resolveElementForScopedColumns(el, 'fig')
    elseif hasTableRef(el) then
      resolveElementForScopedColumns(el, 'tbl')
    end
  end
end

-- forward column classes from code chunks onto their display / outputs
function resolveColumnClassesForCodeCell(el) 

  -- read the classes that should be forwarded
  local figClasses = computeClassesForScopedColumns(el, 'fig')
  local tblClasses = computeClassesForScopedColumns(el, 'tbl')
  local figCaptionClasses = computeClassesForScopedCaption(el, 'fig')
  local tblCaptionClasses = computeClassesForScopedCaption(el, 'tbl')

  if #tblClasses > 0 or #figClasses > 0 or #figCaptionClasses > 0 or #tblCaptionClasses > 0 then 
    noteHasColumns()
    
    if hasLayoutAttributes(el) then
      -- This is a panel, don't resolve any internal classes, only resolve 
      -- actually column classes for this element itself
      resolveColumnClassesForEl(el)
    else
      -- Forward the column classes inside code blocks
      for i, childEl in ipairs(el.content) do 
        if childEl.attr ~= nil and childEl.attr.classes:includes('cell-output-display') then

          -- look through the children for any figures or tables
          local forwarded = false
          for j, figOrTableEl in ipairs(childEl.content) do
            local figure = discoverFigure(figOrTableEl, false)
            if figure ~= nil then
              -- forward to figures
              applyClasses(figClasses, figCaptionClasses, el, childEl, figure, 'fig')
              forwarded = true
            elseif figOrTableEl.attr ~= nil and hasFigureRef(figOrTableEl) then
              -- forward to figure divs
              applyClasses(figClasses, figCaptionClasses, el, childEl, figOrTableEl, 'fig')
              forwarded = true
            elseif (figOrTableEl.t == 'Div' and hasTableRef(figOrTableEl)) then
              -- for a table div, apply the classes to the figOrTableEl itself
              applyClasses(tblClasses, tblCaptionClasses, el, childEl, figOrTableEl, 'tbl')
              forwarded = true
            elseif figOrTableEl.t == 'Table' then
              -- the figOrTableEl is a table, just apply the classes to the div around it
              applyClasses(tblClasses, tblCaptionClasses, el, childEl, childEl, 'tbl')
              forwarded = true
            end
          end

          -- no known children were discovered, apply the column classes to the cell output display itself
          if not forwarded then 
            
            -- figure out whether there are tables inside this element
            -- if so, use tbl scope, otherwise treat as a fig
            local tableCount = countTables(el)
            local scope = 'fig'
            if tableCount > 0 then
              scope = 'tbl'
            end

            -- forward the classes from the proper scope onto the cell-output-display div
            local colClasses = computeClassesForScopedColumns(el, scope)
            local capClasses = computeClassesForScopedCaption(el, scope)
            applyClasses(colClasses, capClasses, el, childEl, childEl, scope)

          end
        end
      end
    end
  end         
end

function applyClasses(colClasses, captionClasses, containerEl, colEl, captionEl, scope)
  if #colClasses > 0 then
    applyColumnClasses(colEl, colClasses, scope)
    clearColumnClasses(containerEl, scope)
  end
  if #captionClasses > 0 then
    applyCaptionClasses(captionEl, captionClasses, scope)
    clearCaptionClasses(containerEl, scope)
  end
end

function resolveElementForScopedColumns(el, scope) 
  local classes = computeClassesForScopedColumns(el, scope)
  if #classes > 0 then
    applyColumnClasses(el, classes, scope)
  end

  local captionClasses = computeClassesForScopedCaption(el, scope)
  if #captionClasses > 0 then
    applyCaptionClasses(el, captionClasses, scope)
  end
end

function clearColumnClasses(el, scope)
  removeColumnClasses(el)
  if scope ~= nil then
    removeScopedColumnClasses(el, scope)
  end
end

function clearCaptionClasses(el, scope) 
  removeCaptionClasses(el)
  if scope ~= nil then
    removeScopedCaptionClasses(el, scope)
  end
end

function applyCaptionClasses(el, classes, scope)
  -- note that we applied a column class
  noteHasColumns()

  -- clear existing columns
  removeCaptionClasses(el)
  if scope ~= nil then
    removeScopedCaptionClasses(el, scope)
  end

  -- write the resolve scopes
  tappend(el.attr.classes, classes)
end

function applyColumnClasses(el, classes, scope) 
  -- note that we applied a column class
  noteHasColumns()

  -- clear existing columns
  removeColumnClasses(el)
  if scope ~= nil then
    removeScopedColumnClasses(el, scope)
  end

  -- write the resolve scopes
  tappend(el.attr.classes, classes)
end

function computeClassesForScopedCaption(el, scope)
  local globalCaptionClasses = captionOption('cap-location')
  local elCaptionClasses = resolveCaptionClasses(el)
  local orderedCaptionClasses = {elCaptionClasses, globalCaptionClasses}

  -- if a scope has been provided, include that
  if scope ~= nil then
    local elScopedCaptionClasses = resolveScopedCaptionClasses(el, scope)
    local scopedCaptionClasses = captionOption(scope .. '-cap-location')
    tprepend(orderedCaptionClasses, {elScopedCaptionClasses, scopedCaptionClasses})
  end

  for i, classes in ipairs(orderedCaptionClasses) do 
    if #classes > 0 then
      return classes
    end
  end
  return {}
end

-- Computes the classes for a given element, given its scope
function computeClassesForScopedColumns(el, scope) 
  local columnGlobalClasses = columnOption('column')
  local columnElClasses = resolveColumnClasses(el)
  local orderedClasses = {columnElClasses, columnGlobalClasses}

  -- if a scope has been provided, include that
  if scope ~= nil then
    local scopedGlobalClasses = columnOption(scope .. '-column')
    local scopedElClasses = resolveScopedColumnClasses(el, scope)
    tprepend(orderedClasses, {scopedElClasses, scopedGlobalClasses})
  end
  
  for i, classes in ipairs(orderedClasses) do 
    if #classes > 0 then
      return classes
    end
  end
  return {}
end

-- reads a column option key and returns the value
-- as a table of strings 
function columnOption(key) 
  local value = option(key,  nil)
  if value == nil or #value < 1 then
    return {}
  else
    return {'column-' .. inlinesToString(value[1])}
  end
end

function captionOption(key)
  local value = option(key,  nil)
  if value ~= nil then
  end
  if value ~= nil and value[1].text == 'margin' then
    return {'margin-caption'}
  else
    return {}
  end
end

function mergedScopedColumnClasses(el, scope)
  local scopedClasses = resolveScopedColumnClasses(el, scope)
  if #scopedClasses == 0 then
    scopedClasses = scopedColumnClassesOption(scope)
  end
  return scopedClasses
end

function resolveScopedColumnClasses(el, scope)
  local filtered = el.attr.classes:filter(function(clz)
    return clz:match('^' .. scope .. '%-column%-')
  end)

  return tmap(filtered, function(clz)
    return clz:sub(5)
  end)
end

function resolveScopedCaptionClasses(el, scope)
  local filtered = el.attr.classes:filter(function(clz)
    return clz:match('^' .. scope .. '%-cap%-location%-')
  end)

  local mapped = tmap(filtered, function(clz)
    return clz:sub(18)
  end)
  
  if tcontains(mapped, 'margin') then
    return {'margin-caption'}
  else 
    return {}
  end
end

function removeScopedColumnClasses(el, scope) 
  for i, clz in ipairs(el.attr.classes) do 
    if clz:match('^' .. scope .. '%-column%-') then
      el.attr.classes:remove(i)
    end
  end
end

function removeScopedCaptionClasses(el, scope)
  for i, clz in ipairs(el.attr.classes) do 
    if clz:match('^' .. scope .. '%-cap%-location%-') then
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