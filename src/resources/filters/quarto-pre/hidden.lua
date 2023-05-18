-- hidden.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

function hidden()

  local function stripHidden(el)
    if el.attr.classes:find("hidden") then
      return {}
    end
  end

  local function clearHiddenClasses(el) 
    local _val, idx = el.attr.classes:find("hidden") 
    if idx then
      el.attr.classes:remove(idx);
      return el
    else
      return undefined
    end
  end
  
  local stripHiddenCellFilter = {
    Div = stripHidden,
    CodeBlock = stripHidden
  }

  local clearHiddenClassesFilter = {
    Div = clearHiddenClasses,
    CodeBlock = clearHiddenClasses
  }

  if param("keep-hidden", false) and not _quarto.format.isHtmlOutput() then
    return stripHiddenCellFilter
  elseif param("remove-hidden", false) then
    return stripHiddenCellFilter
  elseif param("clear-hidden-classes", false) then
    return clearHiddenClassesFilter
  else
    return {

    }
  end
end



