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

function columnToClass(column)
  if column ~= nil then
    return 'column-' .. column[1].text
  else
    return nil
  end
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