-- engine-escape.lua
-- Copyright (C) 2021 by RStudio, PBC

local kEngineEscapePattern = "{({+([^}]+)}+)}"

function engineEscape()
  return {
    CodeBlock = function(el)

      -- handle code block with 'escaped' language engine
      if #el.attr.classes == 1 then
        local engine, lang = el.attr.classes[1]:match(kEngineEscapePattern)
        if engine then
          el.text = "```" .. engine .. "\n" .. el.text .. "\n" .. "```"
          el.attr.classes[1] = lang:match("^%w+")
          return el
        end
      end

      -- handle escaped engines within a code block
      el.text = el.text:gsub("```" .. kEngineEscapePattern, function(engine, lang)
        if #el.attr.classes == 0 then
          el.attr.classes:insert(lang:match("^%w+"))
        end
        return "```" .. engine 
      end)
      return el
    end
  }
end