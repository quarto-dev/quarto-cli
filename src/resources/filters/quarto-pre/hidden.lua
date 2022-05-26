-- hidden.lua
-- Copyright (C) 2020 by RStudio, PBC

function hidden()
  if (param("keep-hidden", false)) then
    return {
      Div = stripHidden,
      CodeBlock = stripHidden
    }
  else
    return {

    }
  end
end

function stripHidden(el)
  if not _quarto.format.isHtmlOutput() and el.attr.classes:find("hidden") then
    return pandoc.Null()
  end
end
