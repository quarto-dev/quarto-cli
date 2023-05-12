-- input-traits.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

local constants = require("../modules/constants")

function addInputTrait(key, value)
  preState.results.inputTraits[key] = value
end

function input_traits() 
  return {
    Div = function(el) 
      if el.attr.identifier == 'refs' then
        addInputTrait(constants.kPositionedRefs, true) 
      end
    end
  }
end
