-- hidden.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

local kNone = "none"
local kCode = "code"
local kWarning = "warning"
local kAll = "all"

local kKeepHidden = "keep-hidden"
local kRemoveHidden = "remove-hidden"
local kClearHiddenClasses = "clear-hidden-classes"

function hidden()

  local function stripHidden(el)
    if el.attr.classes:find("hidden") then
      return {}
    end
  end

  local function clearHiddenClasses(el) 
    local val, idx = el.attr.classes:find("hidden") 
    if idx then
      el.attr.classes:remove(idx);
      return el
    else
      return undefined
    end
  end
  
  local function isWarning(el)
    return el.attr.classes:find("cell-output-stderr")
  end

  local stripHiddenCellFilter = {
    Div = stripHidden,
    CodeBlock = stripHidden
  }

  if param(kKeepHidden, false) and not _quarto.format.isHtmlOutput() then
    return stripHiddenCellFilter
  else 
    -- Allow additional control of what to do with hidden code and warnings
    -- in the output. This allows rendering with echo/warning=false and keep-hidden=true
    -- to do some additional custom processing (for example, marking all as hidden, but
    -- but then removing the hidden elements from the output). 
    local removeHidden = param(kRemoveHidden, "none")
    local clearHiddenClz = param(kClearHiddenClasses, "none")
    if removeHidden ~= kNone or clearHiddenClz ~= kNone then

      local function remove(thing) 
        return removeHidden == kAll or removeHidden == thing
      end

      local function clear(thing)
        return clearHiddenClz == kAll or clearHiddenClz == thing
      end

      local function clearOrRemoveEl(el) 
        if isWarning(el) then
          if remove(KWarning) then
            return stripHidden(el)
          elseif clear(kWarning) then
            return clearHiddenClasses(el)
          end
        else
          if remove(kCode) then
            return stripHidden(el)
          elseif clear(kCode) then
            return clearHiddenClasses(el)
          end
        end
      end

      return {
        Div = clearOrRemoveEl,
        CodeBlock = clearOrRemoveEl
      }
    else
      return {}
    end
  end
end






