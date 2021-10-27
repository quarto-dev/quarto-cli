-- columns.lua
-- Copyright (C) 2021 by RStudio, PBC

function columns() 
  
  return {
  
    Div = function(el)  
      -- Process column classes on divs
      if el.attr.classes:includes('cell') then
        forwardColumnClass(el)
      end

      if el.attr.classes:includes('aside') then
        renderAside(el)
      end

      return el      
    end,

    RawBlock = function(el) 
      -- Implements support for raw <aside> tags and replaces them with
      -- our raw latex representation
      if isLatexOutput() then
        if el.format == 'html' then
          if el.text == '<aside>' then 
            el = beginSideNote()
          elseif el.text == '</aside>' then
            el = endSideNote()
          end
          return el
        end
      end
    end,

    Para = function(el) 
      if el.attr ~= undefined then
        local columnClasses = el.attr.classes:filter(isColumnClass)
        if #columnClasses > 0 then
            -- Note that we are using columns
            preState.hasColumns = true
        end
      end
    end
  }
end

function forwardColumnClass(el) 

  -- read the classes that should be forwarded
  local columnClasses = el.attr.classes:filter(isColumnClass)
  if #columnClasses > 0 then 
    -- Note that we are using columns
    preState.hasColumns = true

    -- Forward the column classes to figures
    for i, childEl in ipairs(el.content) do 
      if childEl.attr ~= undefined and childEl.attr.classes:includes('cell-output-display') then
        -- look through the children for any figures
        for j, figEl in ipairs(childEl.content) do
          local figure = discoverFigure(figEl, true)
            if figure ~= nil then
              tappend(figure.attr.classes, columnClasses)
            end
        end
      end
    end

  end         

end

function renderAside(el) 
  if isLatexOutput() and #el.content == 1 and el.content[1].t == 'Para' then
    local p = el.content[1]
    tprepend(p.content, {beginSideNote(true)})
    tappend(p.content, {endSideNote(true)})
  end
end

function beginSideNote(inline) 
  if inline then
    return pandoc.RawInline('latex', '\\begin{footnotesize}\\marginnote{')
  else 
    return pandoc.RawBlock('latex', '\\begin{footnotesize}\\marginnote{')
  end
end

function endSideNote(inline) 
  if inline then
    return pandoc.RawInline('latex', '}\\end{footnotesize}')
  else
    return pandoc.RawBlock('latex', '}\\end{footnotesize}')
  end
end

function isColumnClass(clz) 
  if clz == undefined then
    return false
  else
    return clz:match('^column%-')
  end
end