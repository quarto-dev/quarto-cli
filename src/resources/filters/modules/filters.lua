-- filters.lua
-- utility functions for filters
--
-- Copyright (C) 2023 Posit Software, PBC

-- drop a class from an element
-- NB: mutates the element
local function drop_class(class)
  return function(el)
    el.classes = el.classes:filter(function(c) return c ~= class end)
    return el
  end
end

return {
  drop_class = drop_class
}