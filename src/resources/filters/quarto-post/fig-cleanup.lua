-- fig-cleanup.lua
-- Copyright (C) 2021-2022 Posit Software, PBC


local function stripFigAnonymous(el)
  if isAnonymousFigId(el.attr.identifier) then
    el.attr.identifier = ""
    return el
  end
end

function figCleanup() 
  return {
    Div = stripFigAnonymous,
    Image = stripFigAnonymous
  }
end


