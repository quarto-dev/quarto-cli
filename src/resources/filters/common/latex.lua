-- latex.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- generates a set of options for a tColorBox
function tColorOptions(options) 

  local optionStr = ""
  local prepend = false
  for k, v in pairs(options) do
    if (prepend) then 
      optionStr = optionStr .. ', '
    end
    if v ~= "" then
      optionStr = optionStr .. k .. '=' .. v
    else
      optionStr = optionStr .. k
    end
    prepend = true
  end
  return optionStr

end
