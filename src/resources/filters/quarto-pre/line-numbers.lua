-- line-numbers.lua
-- Copyright (C) 2020-2022 Posit Software, PBC


function line_numbers()
  return {
    CodeBlock = function(el)
      if #el.attr.classes > 0 then
        local lineNumbers = lineNumbersAttribute(el)
        if lineNumbers ~= false then
          -- use the pandoc line numbering class
          el.attr.classes:insert("number-lines")
          -- remove for all formats except reveal and docusaurus
          if not _quarto.format.isRevealJsOutput() and not _quarto.format.isDocusaurusOutput() then
            el.attr.attributes["code-line-numbers"] = nil
          end
          return el
        end
      end
    end
  }
end

function lineNumbersAttribute(el)
  local default = param("code-line-numbers", false)
  local lineNumbers = attribute(el, "code-line-numbers", default)
  if lineNumbers == true or lineNumbers == "true" or lineNumbers == "1" then
    return true
  elseif lineNumbers == false or lineNumbers == "false" or lineNumbers == "0" then
    return false
  else
    return tostring(lineNumbers)
  end
end