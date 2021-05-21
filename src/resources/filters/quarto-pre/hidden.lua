-- hidden.lua
-- Copyright (C) 2020 by RStudio, PBC

function hidden()
  return {
    Div = stripHidden,
    CodeBlock = stripHidden
  }
end

function stripHidden(el)
  if not isHtmlOutput() and el.attr.classes:find("hidden") then
    return pandoc.Null()
  end
end
