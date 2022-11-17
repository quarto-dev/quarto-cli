-- input-traits.lua
-- Copyright (C) 2020-2022 Posit Software, PBC


function addInputTrait(key, value)
  preState.results.inputTraits[key] = value
end

local kPositionedRefs = 'positioned-refs'
function inputTraits() 
  return {
    Div = function(el) 
      local hasPositionedRefs = el.attr.identifier == 'refs'
      if (hasPositionedRefs) then
        addInputTrait(kPositionedRefs, true) 
      end
    end
  }
end
