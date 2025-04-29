-- columns.lua
-- Copyright (C) 2021-2022 Posit Software, PBC


kSideCaptionClass = 'margin-caption'

local function def_columns()
  local function is_column_attribute(key)
    return key == 'offset'
  end

  local function remove_column_attributes(el)
    if el.attributes then
      for k, v in pairs(el.attributes) do
        if is_column_attribute(k) then
          el.attributes[k] = nil
        end
      end
    end
  end

  local function add_column_classes_and_attributes(classes, attributes, toEl) 
    removeColumnClasses(toEl)
    remove_column_attributes(toEl)
    for i, clz in ipairs(classes) do 
      if isColumnClass(clz) then
        toEl.classes:insert(clz)
      end
    end
    for i, kv in ipairs(attributes) do
      if is_column_attribute(kv[1]) then
        toEl.attributes[kv[1]] = kv[2]
      end
    end
  end  

  local function applyFigureColumns(columnClasses, columnAttributes, figure)
    -- just ensure the classes are - they will be resolved
    -- when the latex figure is rendered
    add_column_classes_and_attributes(columnClasses, columnAttributes, figure)
  
    -- ensure that extended figures will render this
    forceExtendedFigure(figure)  
  end
  
  function resolve_column_attributes(el)
    local result = pandoc.List({})
    for i, kv in ipairs(el.attributes) do
      if is_column_attribute(kv[1]) then
        result:insert(kv)
      end
    end
    return result
  end

  local function processOtherContent(el)
    if hasMarginColumn(el) then
      -- (margin notes)
      noteHasColumns()
      tprepend(el.content, {latexBeginSidenote()});
      tappend(el.content, {latexEndSidenote(el)})
    else 
      -- column classes, but not a table or figure, so 
      -- handle appropriately
      local otherEnv = latexOtherEnv(el)
      if otherEnv ~= nil then
        latexWrapEnvironment(el, otherEnv, false)
      end
    end
    removeColumnClasses(el)
  end

  local function renderDivColumn(el) 

    -- for html output that isn't reveal...
    if _quarto.format.isHtmlOutput() and not _quarto.format.isHtmlSlideOutput() then
  
      -- For HTML output, note that any div marked an aside should
      -- be marked a column-margin element (so that it is processed 
      -- by post processors). 
      -- For example: https://github.com/quarto-dev/quarto-cli/issues/2701
      if el.classes and tcontains(el.classes, 'aside') then
        noteHasColumns()
        el.classes = el.classes:filter(function(attr) 
          return attr ~= "aside"
        end)
        tappend(el.classes, {'column-margin', "margin-aside"})
        return el
      end
  
    elseif el.identifier and el.identifier:find("^lst%-") then
      -- for listings, fetch column classes from sourceCode element
      -- and move to the appropriate spot (e.g. caption, container div)
      local captionEl = el.content[1]
      local codeEl = el.content[2]
      
      if captionEl and codeEl then
        local columnClasses = resolveColumnClasses(codeEl)
        if #columnClasses > 0 then
          noteHasColumns()
          removeColumnClasses(codeEl)
  
          for i, clz in ipairs(columnClasses) do 
            if clz == kSideCaptionClass and _quarto.format.isHtmlOutput() then
              -- wrap the caption if this is a margin caption
              -- only do this for HTML output since Latex captions typically appear integrated into
              -- a tabular type layout in latex documents
              local captionContainer = pandoc.Div({captionEl}, pandoc.Attr("", {clz}))
              el.content[1] = codeEl
              el.content[2] = captionContainer    
            else
              -- move to container
              el.classes:insert(clz)
            end
          end
        end
      end
  
    elseif _quarto.format.isLatexOutput() and not requiresPanelLayout(el) then
  
      -- see if there are any column classes
      local columnClasses = resolveColumnClasses(el)
      local columnAttributes = resolve_column_attributes(el)
      if #columnClasses > 0 then
        noteHasColumns() 
        
        if el.classes:includes('cell-output-display') and #el.content > 0 then
          -- this could be a code-display-cell
          local figOrTable = false
          local floatRefTarget = false
          for j=1,#el.content do
            local contentEl = el.content[j]
  
            -- wrap figures
            local figure = discoverFigure(contentEl, false)
            if figure ~= nil then
              applyFigureColumns(columnClasses, columnAttributes, figure)
              figOrTable = true
            elseif is_regular_node(contentEl, "Div") and hasTableRef(contentEl) then
              -- wrap table divs
              latexWrapEnvironment(contentEl, latexTableEnv(el), false)
              figOrTable = true
              el.classes = el.classes:filter(function(clz) 
                return not isStarEnv(clz)
              end)
            elseif contentEl.attr ~= nil and hasFigureRef(contentEl) then
              -- wrap figure divs
              latexWrapEnvironment(contentEl, latexFigureEnv(el), false)
              figOrTable = true
              el.classes = el.classes:filter(function(clz) 
                return not isStarEnv(clz)
              end)
            elseif contentEl.t == 'Table' then
              -- TODO do-not-create-environment is hack we add on parsefiguredivs.lua
              -- to handle floatreftarget that have layout elements. we need
              -- this to not doubly-emit table* environments, because in this
              -- specific case, the floatreftarget renderer will handle the
              -- environment creation.
              --
              -- it's likely that the lines around here which create environments also
              -- need to get the same treatment
              if contentEl.classes:includes("do-not-create-environment") then
                contentEl.classes = contentEl.classes:filter(function(clz) 
                  return clz ~= "do-not-create-environment"
                end)
              else
                -- wrap the table in a div and wrap the table environment around it
                contentEl.classes:insert("render-as-tabular")
                local tableDiv = pandoc.Div({contentEl})
                latexWrapEnvironment(tableDiv, latexTableEnv(el), false)
                el.content[j] = tableDiv
                figOrTable = true
  
                -- In this case, we need to remove the class from the parent element
                -- It also means that divs that want to be both a figure* and a table*
                -- will never work and we won't get the column-* treatment for 
                -- everything, just for the table.
                el.classes = el.classes:filter(function(clz) 
                  return not isStarEnv(clz)
                end)
              end
            elseif is_custom_node(contentEl, "FloatRefTarget") then
              -- forward the columns class from the output div
              -- onto the float ref target, which prevents
              -- the general purpose `sidenote` processing from capturing this
              -- element (since floats know how to deal with margin positioning)
              local custom = _quarto.ast.resolve_custom_data(contentEl)
              if custom ~= nil then  
                floatRefTarget = true
                removeColumnClasses(el)
                add_column_classes_and_attributes(columnClasses, columnAttributes, custom)
              end
            end 
          end
  
          if not figOrTable and not floatRefTarget then
            processOtherContent(el.content)
          end
        else
  
          -- this is not a code cell so process it
          if el.attr ~= nil then
            if hasTableRef(el) then
              latexWrapEnvironment(el, latexTableEnv(el), false)
            elseif hasFigureRef(el) then
              latexWrapEnvironment(el, latexFigureEnv(el), false)
            else
              -- this is likely a generic div with a column class
              -- two cases: either there are floats inside or not
              -- if there are floats, then we need to break those out
              -- into "individually-wrapped" divs
              local floatRefTargets = el.content:filter(function(contentEl)
                return is_custom_node(contentEl, "FloatRefTarget")
              end)
              local nonFloatContent = el.content:filter(function(contentEl)
                return not is_custom_node(contentEl, "FloatRefTarget")
              end)
              if #floatRefTargets ~= 0 and #nonFloatContent ~= 0 then
                warn("Mixed content in a div with column classes. Margin placement will not work as expected. Consider moving the floatref targets to their own divs and using the `offset` attribute.")
              end
              if #floatRefTargets > 0 and #nonFloatContent == 0 then
                warn("FloatRefTarget elements should not be the only content in a div with column classes. This will not render as expected. Consider moving the floatref targets to their own divs and using the `offset` attribute.")
              end
              if #floatRefTargets == 0 then
                processOtherContent(el)
              else
                local result = pandoc.Blocks({})
                for i, contentEl in ipairs(el.content) do
                  if is_custom_node(contentEl, "FloatRefTarget") then
                    -- forward the columns class from the output div
                    -- onto the float ref target, which prevents
                    -- the general purpose `sidenote` processing from capturing this
                    -- element (since floats know how to deal with margin positioning)
                    local custom = _quarto.ast.resolve_custom_data(contentEl)
                    if custom ~= nil then  
                      removeColumnClasses(el)
                      add_column_classes_and_attributes(columnClasses, columnAttributes, custom)
                      result:insert(contentEl)
                    end
                  else
                    local inner_div = pandoc.Div({contentEl}, pandoc.Attr("", columnClasses))
                    processOtherContent(inner_div)
                    result:insert(inner_div)
                  end
                end
                return result
              end
            end
          end
        end   
      else 
         -- Markup any captions for the post processor
        latexMarkupCaptionEnv(el);
      end
    end
  end
  
  -- note the intentionally global definition here
  function columns() 
  
    return {
  
      Div = function(el)  
        -- for any top level divs, render then
        return renderDivColumn(el) or el
      end,
  
      Span = function(el)
        -- a span that should be placed in the margin
        if _quarto.format.isLatexOutput() and hasMarginColumn(el) then 
          noteHasColumns()
          tprepend(el.content, {latexBeginSidenote(false)})
          tappend(el.content, {latexEndSidenote(el, false)})
          removeColumnClasses(el)
          return el
        else 
          -- convert the aside class to a column-margin class
          if el.classes and tcontains(el.classes, 'aside') then
            noteHasColumns()
            el.classes = el.classes:filter(function(attr) 
              return attr ~= "aside"
            end)
            tappend(el.classes, {'column-margin', 'margin-aside'})
            return el
          end
        end
      end,
  
      RawBlock = function(el) 
        -- Implements support for raw <aside> tags and replaces them with
        -- our raw latex representation
        if _quarto.format.isLatexOutput() then
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
end
def_columns()

-- functions currently used outside columns.lua
function hasColumnClasses(el) 
  return tcontains(el.classes, isColumnClass) or hasMarginColumn(el)
end

function hasMarginColumn(el)
  if el.classes ~= nil then
    return tcontains(el.classes, 'column-margin') or tcontains(el.classes, 'aside')
  else
    return false
  end
end

function hasMarginCaption(el)
  if el.classes ~= nil then
    return tcontains(el.classes, 'margin-caption')
  else
    return false
  end
end

function noteHasColumns() 
  layoutState.hasColumns = true
end

function notColumnClass(clz) 
  return not isColumnClass(clz)
end

function resolveColumnClasses(el) 
  return el.classes:filter(isColumnClass)
end

function columnToClass(column)
  if column ~= nil then
    return 'column-' .. column[1].text
  else
    return nil
  end
end

function removeColumnClasses(el)
  if el.classes then
    el.classes = el.classes:filter(notColumnClass)
  end
end

function removeCaptionClasses(el)
  for i, clz in ipairs(el.classes) do 
    if isCaptionClass(clz) then
      el.classes:remove(i)
    end
  end
end

function resolveCaptionClasses(el)
  local filtered = el.classes:filter(isCaptionClass)
  if #filtered > 0 then
    return {'margin-caption'}
  else
    -- try looking for attributes
    if el.attributes ~= nil and el.attributes['cap-location'] == "margin" then
      return {'margin-caption'}
    else
      return {}
    end
  end
end

function isCaptionClass(clz)
  return clz == 'caption-margin' or clz == 'margin-caption'
end

function isColumnClass(clz) 
  if clz == nil then
    return false
  elseif clz == 'aside' then
    return true
  else
    return clz:match('^column%-')
  end
end

