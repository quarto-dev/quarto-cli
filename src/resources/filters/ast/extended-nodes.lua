local handlers = {
  {
    -- use either string or array of strings
    className = "fancy-callout",
    -- className = {"fancy-callout-warning", "fancy-callout-info", ... }

    -- optional: makePandocExtendedDiv
    -- supply makePandocExtendedDiv if you need to construct
    -- your want to create and extended pandoc Div
    -- 
    -- This is here as an escape hatch, we expect most developers
    -- to not need it.
    -- makePandocExtendedDiv = function(table)
    --   -- returns a pandoc Div that can be parsed back into a table
    --   -- later use
    -- end

    -- the name of the ast node, used as a key in extended ast filter tables
    astName = "FancyCallout",

    -- a function that takes the extended ast node as supplied in user markdown
    -- and returns a new Pandoc node (use quarto.ast.pandoc instead of pandoc if
    -- you need access to extended ast nodes)
    parse = function(div)
      return quarto.ast.custom("FancyCallout", {
        title = div.content[1],
        content = div.content[2],
      })
    end,

    -- a function that renders the extendedNode into output
    render = function(extendedNode)
      return pandoc.Div(pandoc.Blocks({
        extendedNode.title, extendedNode.content
      }))
    end,
  },
}

kExtendedAstTag = "quarto-extended-ast-tag"

function ast_node_property_pairs(node)
  local next = pairs(node)
  local index

  return function()
    local k, v
    repeat
      k, v = next(node, index)
      if k == nil then
        return nil
      end
      index = k
    until k ~= "attr" and type(v) ~= "function"
    return k, v
  end
end

function ast_node_array_map(node_array, fn)
  if tisarray(node_array) then
    return tmap(node_array, fn)
  else
    local result = create_emulated_node(node_array.t)
    for k, v in pairs(node_array) do
      result[k] = fn(v)
    end
    return result
  end
end

local pandoc_ast_methods = {
  show = function(_)
    return "UNIMPLEMENTED_SHOW_RESULT"
  end,
  clone = function(self)
    -- FIXME this should be a deep copy
    return quarto.ast.copy_as_emulated_node(self)
  end,
  walk = emulate_pandoc_walk,

  -- custom nodes override this in their metatable
  is_custom = false
}

function create_emulated_node(t, is_custom)
  if t == "Inlines" or t == "Blocks" or t == "List" then
    return pandoc[t]({})
  end
  local ExtendedAstNode = {}
  is_custom = is_custom or false
  -- if pandoc_has_attr[t] then
  --   ExtendedAstNode.attr = pandoc.Attr() -- let's not try to reinvent this one because 'attributes' is tricky
  -- end

  local metaFields = {
    t = t,
    is_emulated = true,
    is_custom = is_custom
  }

  for k, v in pairs(pandoc_fixed_field_types[t] or {}) do
    metaFields[k] = create_emulated_node(v)
  end

  local special_resolution = function(tbl, key)
    if metaFields[key] then return true, metaFields[key] end
    if key == "-is-extended-ast-" then return true, true end
    if key == "identifier" and tbl.attr then return true, tbl.attr.identifier end
    if key == "attributes" and tbl.attr then return true, tbl.attr.attributes end
    if key == "classes" and tbl.attr then return true, tbl.attr.classes end
    if key == "c" then
      if tbl.content then return true, tbl.content end
    end
    return false
  end
  local method_chain = { pandoc_ast_methods }
  local method_resolution = function(key)
    for _, tbl in pairs(method_chain) do
      local method = tbl[key]
      if method then return method end
    end    
  end

  setmetatable(ExtendedAstNode, {
    __index = function(tbl, key)
      local resolved, value = special_resolution(tbl, key)
      if resolved then return value end
      return method_resolution(key)
    end,
    __eq = pandoc_emulate_eq,
    __pairs = function(tbl)
      local inMeta = pandoc_fixed_field_types[t]
      local index

      return function()
        local k, v
        if inMeta then
          k, v = next(pandoc_fixed_field_types[t], index)
          if k == nil then
            inMeta = false
            index = nil
          else
            index = k
            return k, metaFields[k]
          end
        end

        -- two if statements because we want to fall
        -- through the end of the first into the second
        if not inMeta then
          repeat
            k, v = next(ExtendedAstNode, index)
            if k == nil then
              return nil
            end
            index = k
          until k ~= "attr" and type(v) ~= "function"
          return k, v
        end
      end      
    end,
    __concat = concat_denormalize_first,
    __newindex = function(tbl, key, value)
      -- print("__newindex", key)
      -- crash_with_stack_trace()
      -- return
      local fixedFieldType = (pandoc_fixed_field_types[t] or {})[key]
      if fixedFieldType then
        metaFields[key] = pandoc[fixedFieldType](value)
        --   if value.is_emulated and tbl[key].t ~= value.t then
        --     -- they tried to set content to a bad type, disallow
        --     print("Internal Error: Content needs to be of type " .. tbl[key].t .. " (was given " .. value.t .. ")")
        --     crash_with_stack_trace()            
        --   elseif value.is_emulated then
        --     -- they gave us a good value type, use it
        --     metaFields.content = value
        --   else
        --     print("They gave us a plain array", ExtendedAstNode.t, metaFields.content.t)
        --     -- they gave us a plain array, take it as
        --     -- reason to turn their array into an emulated one of the right type
        --     setmetatable(value, getmetatable(metaFields.content))
        --     metaFields.content = value
        --   end
        -- end
      else
        rawset(tbl, key, value)
      end
    end
  })

  return ExtendedAstNode
end

quarto.ast = {
  custom = function(name, tbl)
    local result = create_emulated_node(name, true)
    for k, v in pairs(tbl) do
      result[k] = v
    end
    return result
  end,

  copy_as_emulated_node = function(el)
    -- this will probably crash other places, but they shouldn't be calling us like this anyway
    if el == nil then return nil end

    if type(el) ~= "table" and type(el) ~= "userdata" then
      error("Internal Error: copy_as_emulated_node can't handle type " .. type(el))
      crash_with_stack_trace()
      return create_emulated_node("Div") -- a lie to appease to type system
    end

    local ExtendedAstNode = create_emulated_node(
      el.t or pandoc.utils.type(el),
      el.is_custom or false
    )

    if pandoc_has_attr[el.t] then
      ExtendedAstNode.attr = pandoc.Attr(el.attr)
    end

    function is_content_field(k)
      return k ~= "walk" and k ~= "clone" and k ~= "show"
    end

    for k, v in pairs(el) do
      if is_content_field(k) then
        ExtendedAstNode[k] = v
      end
    end
    return ExtendedAstNode
  end,

  normalize = normalize,
  denormalize = denormalize,
  
  addHandler = function(handler)
    local state = (preState or postState).extendedAstHandlers
    if type(handler.className) == "nil" then
      print("ERROR: handler must define className")
      quarto.utils.dump(handler)
      crash_with_stack_trace()
    elseif type(handler.className) == "string" then
      state.namedHandlers[handler.className] = handler
    elseif type(handler.className) == "table" then
      for _, name in pairs(handler.className) do
        state.namedHandlers[name] = handler
      end
    else
      print("ERROR: className must be a string or an array of strings")
      quarto.utils.dump(handler)
      crash_with_stack_trace()
    end

    -- we also register them under the astName so that we can render it back
    state.namedHandlers[handler.astName] = handler
  end,

  resolve_handler = function(name)
    local state = (preState or postState).extendedAstHandlers
    if state.namedHandlers ~= nil then
      return state.namedHandlers[name]
    end
    return nil
  end,


  unbuild = function(extendedAstNode)
    local name = extendedAstNode.attr.attributes["quarto-extended-ast-tag"]
    local handler = quarto.ast.resolve_handler(name)
    if handler == nil then
      print("ERROR: couldn't find a handler for " .. name)
      crash_with_stack_trace()
    end
    local divTable = { attr = extendedAstNode.attr }
    local key
    for i, v in pairs(extendedAstNode.content) do
      if i % 2 == 1 then
        key = pandoc.utils.stringify(v)
      else
        divTable[key] = v
      end
    end
    divTable.class = pandoc.utils.stringify(divTable.class)
    return divTable
  end,

  build = function(name, nodeTable)
    local handler = quarto.ast.resolve_handler(name)
    if handler == nil then
      print("Internal Error: couldn't find a handler for " .. tostring(name))
      crash_with_stack_trace()
      return pandoc.Div({}, {}) -- a lie to appease the type system
    end
    if handler.makePandocExtendedDiv then
      return handler.makePandocExtendedDiv(nodeTable)
    end

    local resultAttr
    local blocks = {}
    for key, value in pairs(nodeTable) do
      if key == "attr" then
        resultAttr = value
      else
        table.insert(blocks, pandoc.Str(key))
        table.insert(blocks, value)
      end                    
    end
    if resultAttr == nil then
      resultAttr = pandoc.Attr("", { name }, {})
    end
    resultAttr.attributes[kExtendedAstTag] = name
    return pandoc.Div(blocks, resultAttr)
  end,
}

function constructExtendedAstHandlerState()
  local state = {
    namedHandlers = {},
  }

  if preState ~= nil then
    preState.extendedAstHandlers = state
  end
  if postState ~= nil then
    postState.extendedAstHandlers = state
  end

  for i, handler in pairs(handlers) do
    quarto.ast.addHandler(handler)
  end
end

constructExtendedAstHandlerState()

