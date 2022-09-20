-- profile.lua
-- Copyright (C) 2021 by RStudio, PBC

function configProfile()

  local kWhenProfile = "when-profile"
  local kUnlessProfile = "unless-profile"

  local profiles = pandoc.List(param("quarto_profile", {"default"}))

  function hasProfileAttributes(el)
    return el.attributes[kUnlessProfile] ~= nil or
           el.attributes[kWhenProfile] ~= nil
  end

  local function matchesProfile(el)
    local match = true
    if el.attributes[kWhenProfile] ~= nil then
      match = match and profiles:includes(el.attributes[kWhenProfile])
    end
    if el.attributes[kUnlessProfile] ~= nil then
      match = match and not profiles:includes(el.attributes[kUnlessProfile])
    end
    return match
  end

  function clearProfileAttributes(el)
    el.attributes[kUnlessProfile] = nil
    el.attributes[kWhenProfile] = nil
  end

  return {

    Div = function(el)
      if hasProfileAttributes(el) then
        local matches = matchesProfile(el)
        clearProfileAttributes(el)
        if matches then
          return el
        else
          return pandoc.Div({})
        end
      else
        return el
      end
    end,

    Span = function(el)
      if hasProfileAttributes(el) then
        local matches = matchesProfile(el)
        clearProfileAttributes(el)
        if matches then
          return el
        else
          return pandoc.Span({})
        end
      else
        return el
      end
    end
  }

end

