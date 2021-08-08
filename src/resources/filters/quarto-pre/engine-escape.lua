-- engine-escape.lua
-- Copyright (C) 2021 by RStudio, PBC

function engineEscape()
  return {
    CodeBlock = function(el)
      el.text = el.text:gsub("```{({+[^}]+}+)}", "```%1")
      return el
    end
  }
end