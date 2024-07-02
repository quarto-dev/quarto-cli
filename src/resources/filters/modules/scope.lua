-- scope.lua
--
-- utilities for working with Quarto's scoped_walk feature
--
-- Copyright (C) 2024 Posit Software, PBC

local function lookup_attr(scope, attr_name)
  local i = #scope
  while i > 0 do
    local attr
    if is_custom_node(scope[i]) then
      local data = _quarto.ast.resolve_custom_data(scope[i])
      assert(data ~= nil)
      attr = data.attributes
    else
      attr = scope[i].attributes
    end
    if attr and attr[attr_name] then
      return attr[attr_name]
    end
    i = i - 1
  end
end

local function lookup_class(scope, class_name)
  local i = #scope
  while i > 0 do
    local classes
    if is_custom_node(scope[i]) then
      local data = _quarto.ast.resolve_custom_data(scope[i])
      assert(data ~= nil)
      attr = data.classes
    else
      attr = scope[i].classes
    end
    if classes and classes:includes(class_name) then 
      return true
    end
    i = i - 1
  end
end

return {
  lookup_attr = lookup_attr,
  lookup_class = lookup_class
}