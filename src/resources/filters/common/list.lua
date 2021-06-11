-- list.lua
-- Copyright (C) 2020 by RStudio, PBC

function filter(list, test) 
  local result = {}
  for index, value in ipairs(list) do
      if test(value, index) then
          result[#result + 1] = value
      end
  end
  return result
end

