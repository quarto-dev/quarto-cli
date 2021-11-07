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

  if el.identifier and el.identifier:find("^lst%-") then
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
          if clz == kSideCaptionClass and isHtmlOutput() then
            -- wrap the caption if this is a margin caption
            -- only do this for HTML output since Latex captions typically appear integrated into
            -- a tabular type layout in latex documents
            local captionContainer = pandoc.Div({captionEl}, pandoc.Attr("", {clz}))
            el.content[1] = codeEl
            el.content[2] = captionContainer    
          else
            -- move to container
            el.attr.classes:insert(clz)
          end
        end
      end
    end

  elseif isLatexOutput() and not requiresPanelLayout(el) then

    -- see if there are any column classes
    local columnClasses = resolveColumnClasses(el)
    if #columnClasses > 0 then
      noteHasColumns() 
      
      if el.attr.classes:includes('cell-output-display') and #el.content > 0 then
        -- this could be a code-display-cell
        local figOrTable = false
        for j, contentEl in ipairs(el.content) do


          -- wrap figures
          local figure = discoverFigure(contentEl, true)
          if figure ~= nil then
            latexWrapEnvironment(contentEl, latexFigureEnv(el), true)
            figOrTable = true
          elseif contentEl.t == 'Div' and hasTableRef(contentEl) then
            -- wrap table divs
            latexWrapEnvironment(contentEl, latexTableEnv(el), false)
            figOrTable = true
          elseif contentEl.attr ~= undefined and hasFigureRef(contentEl) then
            -- wrap figure divs
            latexWrapEnvironment(contentEl, latexFigureEnv(el), false)
            figOrTable = true
          end 
        end

        if not figOrTable then
          processOtherContent(el.content)
        end
      else
        -- this is not a code cell so process it
        if el.attr ~= undefined then
          if hasTableRef(el) then
            latexWrapEnvironment(el, latexTableEnv(el), false)
          elseif hasFigureRef(el) then
            latexWrapEnvironment(el, latexFigureEnv(el), false)
          else
            processOtherContent(el)
          end
        end
      end   
    else 
       -- Markup any captions for the post processor
      latexMarkupCaptionEnv(el);
    end
  end
end

function processOtherContent(el)
  if hasGutterColumn(el) then
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

function hasGutterColumn(el)
  if el.attr ~= nil and el.attr.classes ~= nil then
    return tcontains(el.attr.classes, 'column-gutter') or tcontains(el.attr.classes, 'aside')
  else
    return false
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

function columnToClass(column)
  if column ~= nil then
    return 'column-' .. column[1].text
  else
    return nil
  end
end

function removeColumnClasses(el)
  if el.attr and el.attr.classes then
    for i, clz in ipairs(el.attr.classes) do 
      if isColumnClass(clz) then
        el.attr.classes:remove(i)
      end
    end  
  end
end

function removeCaptionClasses(el)
  for i, clz in ipairs(el.attr.classes) do 
    if isCaptionClass(clz) then
      el.attr.classes:remove(i)
    end
  end
end

function resolveCaptionClasses(el)
  return el.attr.classes:filter(isCaptionClass)
end

function isCaptionClass(clz)
  return clz == kSideCaptionClass
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