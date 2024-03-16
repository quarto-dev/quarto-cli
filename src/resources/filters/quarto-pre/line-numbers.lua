-- line-numbers.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

local constants = require("modules/constants")

function line_numbers()
  return {
    CodeBlock = function(el)
      if #el.attr.classes > 0 then
        local lineNumbers = lineNumbersAttribute(el)
        el.attr.attributes[constants.kCodeLineNumbers] = nil
        if lineNumbers ~= false then
          -- use the pandoc line numbering class
          el.attr.classes:insert("number-lines")
          -- remove for all formats except reveal and docusaurus
          if type(lineNumbers) == "string" and (_quarto.format.isRevealJsOutput() or _quarto.format.isDocusaurusOutput()) then
            el.attr.attributes[constants.kCodeLineNumbers] = lineNumbers
          end
        end
        return el
      end
    end
  }
end

function lineNumbersAttribute(el)
  local default = param(constants.kCodeLineNumbers, false)
  local lineNumbers = attribute(el, constants.kCodeLineNumbers, default)
  if lineNumbers == true or lineNumbers == "true" or lineNumbers == "1" then
    return true
  elseif lineNumbers == false or lineNumbers == "false" or lineNumbers == "0" then
    return false
  else
    return tostring(lineNumbers)
  end
end