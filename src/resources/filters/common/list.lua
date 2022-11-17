-- list.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

function filter(list, test) 
  local result = {}
  for index, value in ipairs(list) do
      if test(value, index) then
          result[#result + 1] = value
      end
  end
  return result
end

