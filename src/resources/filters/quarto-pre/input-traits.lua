-- input-traits.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

function addInputTrait(key, value)
  quarto_global_state.results.inputTraits[key] = value
end

function input_traits() 
  return {
    Div = function(el) 
      if el.attr.identifier == 'refs' then
        addInputTrait(_quarto.modules.constants.kPositionedRefs, true) 
      end
    end
  }
end
