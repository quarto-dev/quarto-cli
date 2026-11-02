-- code.lua
-- Copyright (C) 2020-2022 Posit Software, PBC
local function toLines(s)
  if s:sub(-1)~="\n" then s=s.."\n" end
  return s:gmatch("(.-)\n")
end

function removeCodeOptions()
  return {
    CodeBlock = function(codeEl)
      local lang = codeEl.attr.classes[1] 
  
      local commentChars = _quarto.modules.constants.kLangCommentChars[lang]
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

function preserve_markdown_code_languages()
  return {
    CodeBlock = function(code)
      if not _quarto.format.isMarkdownOutput() or
          tcontains(PANDOC_WRITER_OPTIONS.extensions, "fenced_code_attributes") then
        return nil
      end
      -- Since Pandoc 3.10.1, bare classes are only treated as languages if
      -- Skylighting knows them. Explicit language-* classes still preserve
      -- arbitrary names, including those interpreted by downstream renderers.
      -- Match the previous writer's first non-sourceCode class convention,
      -- while respecting an already-explicit language anywhere in the list.
      local language
      for _, class in ipairs(code.classes) do
        if class:match("^language%-") then
          return nil
        end
        if language == nil and class ~= "sourceCode" then
          language = class
        end
      end
      if language then
        code.classes:insert("language-" .. language)
        return code
      end
    end
  }
end
