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
          if fragmentIndices ~= nil and _quarto.format.isRevealJsOutput() and isSteppedLineNumbers(lineNumbers) then
            if not validFragmentIndices(fragmentIndices, lineNumbers) then
              warn(
                'Ignoring code-line-fragment-indices="' .. fragmentIndices .. '"; expected ' ..
                countSteps(lineNumbers) .. ' non-negative integers, one for each highlight step after the first.'
              )
            end
            el.attr.attributes[_quarto.modules.constants.kCodeLineFragmentIndices] = fragmentIndices
          end
        end
        if fragmentIndices ~= nil and _quarto.format.isRevealJsOutput() and not isSteppedLineNumbers(lineNumbers) then
          warn(
            'code-line-fragment-indices="' .. fragmentIndices ..
            '" needs a stepped code-line-numbers, such as "|1|2"; the attribute is ignored.'
          )
        end
        return el
      end
    end
  }
end

function isSteppedLineNumbers(lineNumbers)
  return type(lineNumbers) == "string" and string.find(lineNumbers, "|", 1, true) ~= nil
end

function countSteps(lineNumbers)
  local _, count = string.gsub(lineNumbers, "|", "")
  return count
end

function validFragmentIndices(fragmentIndices, lineNumbers)
  local count = 0
  for entry in (fragmentIndices .. ","):gmatch("([^,]*),") do
    if not entry:match("^%s*%d+%s*$") then
      return false
    end
    count = count + 1
  end
  return count == countSteps(lineNumbers)
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