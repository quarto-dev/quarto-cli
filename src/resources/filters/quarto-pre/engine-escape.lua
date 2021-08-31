-- engine-escape.lua
-- Copyright (C) 2021 by RStudio, PBC

function engineEscape()
  return {
    CodeBlock = function(el)
      el.text = el.text:gsub("```{({+([^}]+)}+)}", function(engine, lang)
        if #el.attr.classes == 0 then
          lang = lang:match("^%w+")
          el.attr.classes:insert(lang)
        end
        return "```" .. engine 
      end)
      return el
    end
  }
end