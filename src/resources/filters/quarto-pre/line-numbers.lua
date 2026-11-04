-- line-numbers.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

function line_numbers()
  return {
    CodeBlock = function(el)
      if #el.attr.classes > 0 then
        local lineNumbers = lineNumbersAttribute(el)
        local fragmentIndices = el.attr.attributes[_quarto.modules.constants.kCodeLineFragmentIndices]
        el.attr.attributes[_quarto.modules.constants.kCodeLineNumbers] = nil
        el.attr.attributes[_quarto.modules.constants.kCodeLineFragmentIndices] = nil
        if lineNumbers ~= false then
          -- use the pandoc line numbering class
          el.attr.classes:insert("number-lines")
          -- remove for all formats except reveal and docusaurus
          if type(lineNumbers) == "string" and (_quarto.format.isRevealJsOutput() or _quarto.format.isDocusaurusOutput()) then
            el.attr.attributes[_quarto.modules.constants.kCodeLineNumbers] = lineNumbers
          end
          -- only stepped highlighting in reveal has fragments to index
          if fragmentIndices ~= nil and _quarto.format.isRevealJsOutput() and type(lineNumbers) == "string" and string.find(lineNumbers, "|", 1, true) then
            el.attr.attributes[_quarto.modules.constants.kCodeLineFragmentIndices] = fragmentIndices
          end
        end
        return el
      end
    end
  }
end

function lineNumbersAttribute(el)
  local default = param(_quarto.modules.constants.kCodeLineNumbers, false)
  local lineNumbers = attribute(el, _quarto.modules.constants.kCodeLineNumbers, default)
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