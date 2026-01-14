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
        -- preserve code-line-fragment-indices for revealjs only
        local fragmentIndices = el.attr.attributes[constants.kCodeLineFragmentIndices]
        if fragmentIndices and _quarto.format.isRevealJsOutput() then
          el.attr.attributes[constants.kCodeLineFragmentIndices] = fragmentIndices
        else
          el.attr.attributes[constants.kCodeLineFragmentIndices] = nil
        end
        return el
      end
    end
  }
end

function lineNumbersAttribute(el)
  local default = param(constants.kCodeLineNumbers, false)
  local lineNumbers = attribute(el, constants.kCodeLineNumbers, default)
  -- format that do accept string for this attributes. "1" and "0" should not be parsed as TRUE / FALSE
  local acceptStrings = _quarto.format.isRevealJsOutput() or _quarto.format.isDocusaurusOutput()
  if lineNumbers == true or lineNumbers == "true" or (lineNumbers == "1" and not acceptStrings) then
    return true
  elseif lineNumbers == false or lineNumbers == "false" or lineNumbers == "0" then
    return false
  else
    return tostring(lineNumbers)
  end
end