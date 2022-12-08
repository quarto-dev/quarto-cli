-- pandocemulation.lua
-- sets up pandoc overrides to emulate its behavior in Lua
--
-- Copyright (C) 2022 by RStudio, PBC

function create_emulated_node(t)
  local result = pandoc.RawInline("QUARTO_custom")
  -- if t == "Inlines" or t == "Blocks" or t == "List" then
  --   return pandoc[t]({})
  -- end
  -- local emulatedNode = {}
  -- is_custom = is_custom or false

  -- local metaFields = {
  --   clone = pandoc_ast_methods.clone,
  --   walk = pandoc_ast_methods.walk,
  --   t = t,
  --   is_emulated = true,
  --   is_custom = is_custom
  -- }

  -- for k, v in pairs(pandoc_fixed_field_types[t] or {}) do
  --   metaFields[k] = create_emulated_node(v)
  --   if k == "attr" then
  --     metaFields.identifier = v.identifier
  --     metaFields.classes = v.classes
  --     metaFields.attributes = v.attributes
  --   end
  -- end

  -- setmetatable(emulatedNode, {
  --   __index = metaFields,
  --   __eq = emulated_node_eq,
  --   __pairs = function(tbl)
  --     local inMeta = pandoc_fixed_field_types[t] ~= nil
  --     local index

  --     return function()
  --       local k, v
  --       if inMeta then
  --         k, v = next(pandoc_fixed_field_types[t], index)
  --         if k == nil then
  --           inMeta = false
  --           index = nil
  --         else
  --           index = k
  --           return k, metaFields[k]
  --         end
  --       end

  --       -- two if statements because we want to fall
  --       -- through the end of the first into the second
  --       if not inMeta then
  --         repeat
  --           k, v = next(emulatedNode, index)
  --           if k == nil then
  --             return nil
  --           end
  --           index = k
  --         until k ~= "attr" and type(v) ~= "function"
  --         return k, v
  --       end
  --     end      
  --   end,
  --   __concat = emulated_node_concat,
  --   __newindex = function(tbl, key, value)
  --     local fixedFieldType = (pandoc_fixed_field_types[t] or {})[key]
  --     if key == "classes" and metaFields.attr then
  --       metaFields.attr.classes = value
  --     end
  --     if key == "identifier" and metaFields.attr then
  --       metaFields.attr.identifier = value
  --     end
  --     if key == "attributes" and metaFields.attr then
  --       metaFields.attr.attributes = value
  --     end
  --     if fixedFieldType then
  --       metaFields[key] = pandoc[fixedFieldType](value)
  --       if key == "attr" then
  --         metaFields.identifier = metaFields[key].identifier
  --         metaFields.classes = metaFields[key].classes
  --         metaFields.attributes = metaFields[key].attributes
  --       end
  --     else
  --       rawset(tbl, key, value)
  --     end
  --   end
  -- })

  -- return emulatedNode
end
