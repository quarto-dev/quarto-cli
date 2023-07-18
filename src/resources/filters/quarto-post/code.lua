-- code.lua
-- Copyright (C) 2020-2022 Posit Software, PBC
local constants = require("modules/constants")

local function toLines(s)
  if s:sub(-1)~="\n" then s=s.."\n" end
  return s:gmatch("(.-)\n")
end

function removeCodeOptions()
  return {
    CodeBlock = function(codeEl)
      local lang = codeEl.attr.classes[1] 
  
      local commentChars = constants.kLangCommentChars[lang]
      if commentChars then
        local pattern = '^' .. patternEscape(commentChars[1]) .. "|%s*%S+%s*:.+" 
        if #commentChars == 2 then
          pattern = pattern .. patternEscape(commentChars[2])
        end
        pattern = pattern .. '$'
          
        local outLines = {}
        for line in toLines(codeEl.text) do
          local matches = string.find(line, pattern)
          if not matches then
            tappend(outLines, {line})
          end
        end

        local outputText = ""
        for _, output in ipairs(outLines) do
          outputText = outputText .. output .. '\n'
        end
        codeEl.text = outputText
        return codeEl
      end
    end
  }
end