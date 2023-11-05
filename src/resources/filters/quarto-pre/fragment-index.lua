-- line-numbers.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

local constants = require("modules/constants")

function fragment_index()
  return {
    CodeBlock = function(el)
      if #el.attr.classes > 0 then
        local fragmentIndex = fragmentIndexAttribute(el)
        el.attr.attributes[constants.kFragmentIndex] = nil
        if fragmentIndex ~= nil then
          -- remove for all formats except reveal and docusaurus
          if type(fragmentIndex) == "string" and (_quarto.format.isRevealJsOutput() or _quarto.format.isDocusaurusOutput()) then
            el.attr.attributes[constants.kFragmentIndex] = fragmentIndex
          end
        end
        return el
      end
    end
  }
end

function fragmentIndexAttribute(el)
  local default = param(constants.kFragmentIndex, nil)
  local fragmentIndex = attribute(el, constants.kFragmentIndex, default)
  if fragmentIndex == nil then
    return nil
  else
    return tostring(fragmentIndex)
  end
end
