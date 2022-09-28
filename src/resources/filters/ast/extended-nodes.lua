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

    -- either a function that unconditionally renders the extendedNode into
    -- output, or a table of functions, whose keys are the output formats
    render = function(extendedNode)
      return quarto.ast.pandoc.Div(quarto.ast.pandoc.Blocks({
        extendedNode.title, extendedNode.content
      }))
    end,
    -- render = {
    --   html = function(extendedNode)
    --     -- render to html
    --   end,
    --   pdf = function(extendedNode)
    --     -- render to pdf
    --   end,
    --   docx = function(extendedNode)
    --     -- render to docx
    --   end,
    --   default = function(extendedNode)
    --     -- fallback format
    --   end,
    -- }
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
    until is_plain_key(k) and k ~= "attr" and type(v) ~= "function"
    return k, v
  end
end

function ast_node_array_map(node_array, fn)
  if tisarray(node_array) then
    return tmap(node_array, fn)
  else
    local result = _build_extended_node(node_array.t)
    for k, v in pairs(node_array) do
      if is_plain_key(k) then
        result[k] = fn(v)
      end
    end
    return result
  end
end

local _quarto_pandoc_special_constructors = {
  Inlines = function(args)
    local result = _build_extended_node("Inlines")
    for k, v in pairs(args or {}) do
      if is_plain_key(k) then
        result[k] = v
      end
    end
    return result
  end,
  Blocks = function(args)
    local result = _build_extended_node("Blocks")
    for k, v in pairs(args or {}) do
      if is_plain_key(k) then
        result[k] = v
      end
    end
    return result
  end,
}

pandoc_emulated_node_factory = function(t)
  return function(...)
    local args = { ... }
    -- NB: we can't index into quarto.ast.pandoc in this function
    -- because it's used in the __index metatable of quarto.ast.pandoc
    -- which can cause infinite recursion

    if _quarto_pandoc_special_constructors[t] then
      -- special cases handled directly by quarto.ast.pandoc
      return _quarto_pandoc_special_constructors[t](table.unpack(args))
    end

    local result = _build_extended_node(t)
    local argsTable = pandoc_constructors_args[t]
    if argsTable == nil then
      for i, v in pairs(args) do
        result[i] = v
      end
    else
      for i, v in ipairs(args) do
        result[argsTable[i]] = v
      end
    end
    return result
  end
end

local _quarto_pandoc = {}
setmetatable(_quarto_pandoc, {
  __index = function(_, key)
    return _quarto_pandoc_special_constructors[key] or pandoc_emulated_node_factory(key)
  end
})

pandoc_constructors_args = {
  Pandoc = { "blocks", "meta" },
  
  -- blocks
  BlockQuote = { "content" },
  BulletList = { "content" },
  CodeBlock = { "text", "attr" },
  DefinitionList = { "content" },
  Div = { "content", "attr" },
  Header = { "level", "content", "attr" },
  HorizontalRule = {},
  LineBlock = { "content" },
  Null = {},
  OrderedList = { "content", "listAttributes" },
  Para = { "content" },
  Plain = { "content" },
  RawBlock = { "format", "text" },
  Table = { "caption", "colspecs", "head", "bodies", "foot", "attr" },
  SimpleTable = { "caption", "aligns", "widths", "headers", "rows" },

  -- inlines
  Cite = { "content", "citations" },
  Code = { "text", "attr" },
  Emph = { "content" },
  Image = { "caption", "src", "title", "attr" },
  LineBreak = {},
  Link = { "content", "target", "title", "attr" },
  Math = { "mathtype", "text" },

  -- FIXME add DisplayMath and InlineMath special cases
  Note = { "content" },
  Quoted = { "quotetype", "content" },
  
  -- FIXME add SingleQuoted and DoubleQuoted special cases
  RawInline = { "format", "text" },

  SmallCaps = { "content" },
  SoftBreak = {},
  Space = {},
  Span = { "content", "attr" },
  Str = { "text" },
  Strikeout = { "content" },
  Strong = { "content" },
  Subscript = { "content" },
  Superscript = { "content" },
  Underline = { "content" },

  -- others
  Citation = { "id", "mode", "prefix", "suffix", "note_num", "hash" },
  ListAttributes = { "start", "style", "delimiter" },
  Row = { "cells", "attr" },
  TableFoot = { "rows", "attr" },
  TableHead = { "rows", "attr" },
  TableBody = { "body", "head", "row_head_columns", "attr" },
  Cell = { "contents", "align", "row_span", "col_span", "attr" },
}

local pandoc_ast_methods = {
  show = function(_)
    return "UNIMPLEMENTED_SHOW_RESULT"
  end,
  clone = function(self)
    -- FIXME this should be a deep copy
    return quarto.ast.copyAsExtendedNode(self)
  end,
  walk = emulate_pandoc_walk,

  -- custom nodes override this in their metatable
  is_custom = false
}

pandoc_has_attr = {
  CodeBlock = true,
  Div = true,
  Header = true,
  Table = true,
  Row = true,
  TableFoot = true,
  TableHead = true,
  Cell = true,
  Code = true,
  Image = true,
  Link = true,
  Span = true,
}

pandoc_fixed_field_types = {
  Pandoc = { blocks = "Blocks" },
  BlockQuote = { content = "Blocks" },
  BulletList = { content = "List" }, -- BlocksList, but we can't represent that
  -- DefinitionList

  Div = { content = "Blocks" },
  Header = { content = "Inlines" },
  LineBlock = { content = "List" }, -- InlinesList, but we can't represent that
  OrderedList = { content = "List" }, -- BlocksList, but we can't represent that
  Para = { content = "Inlines" },
  Plain = { content = "Inlines" },
  Cite = { content = "Inlines" },
  Emph = { content = "Inlines" },
  Image = { caption = "Inlines" },
  Link = { content = "Inlines" },
  Note = { content = "Blocks" },
  Quoted = { content = "Inlines" },
  SmallCaps = { content = "Inlines" },
  Span = { content = "Inlines" },
  Strikeout = { content = "Inlines" },
  Strong = { content = "Inlines" },
  Subscript = { content = "Inlines" },
  Superscript = { content = "Inlines" },
  Underline = { content = "Inlines" },
}

function _build_extended_node(t, is_custom)
  if t == "Inlines" or t == "Blocks" or t == "List" then
    return pandoc[t]({})
  end
  local ExtendedAstNode = {}
  is_custom = is_custom or false
  if pandoc_has_attr[t] then
    ExtendedAstNode.attr = pandoc.Attr() -- let's not try to reinvent this one because 'attributes' is tricky
  end

  local metaFields = {
    t = t,
    is_emulated = true,
    is_custom = is_custom
  }

  for k, v in pairs(pandoc_fixed_field_types[t] or {}) do
    metaFields[k] = _build_extended_node(v)
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
          until is_plain_key(k) and k ~= "attr" and type(v) ~= "function"
          return k, v
        end
      end      
    end,
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
  pandoc = _quarto_pandoc,

  custom = function(name, tbl)
    local result = _build_extended_node(name, true)
    for k, v in pairs(tbl) do
      result[k] = v
    end
    return result
  end,

  copyAsExtendedNode = function(el)
    -- this will probably crash other places, but they shouldn't be calling us like this anyway
    if el == nil then return nil end

    if type(el) ~= "table" and type(el) ~= "userdata" then
      error("Internal Error: copyAsExtendedNode can't handle type " .. type(el))
      crash_with_stack_trace()
      return _build_extended_node("Div") -- a lie to appease to type system
    end

    local ExtendedAstNode = _build_extended_node(
      el.t or pandoc.utils.type(el),
      el.is_custom or false
    )

    if pandoc_has_attr[el.t] then
      local attr1 = pandoc.Attr({ id = "foo1" })
      local attr2 = pandoc.Attr(attr1)
      ExtendedAstNode.attr = pandoc.Attr(el.attr)
    end

    function is_content_field(k)
      return k ~= "walk" and k ~= "clone" and k ~= "show" and is_plain_key(k)
    end

    for k, v in pairs(el) do
      if k == "content" then
        for _, innerV in pairs(v) do
          -- can't set the table directly because we lose method information
          ExtendedAstNode.content:insert(innerV)
        end
      elseif is_content_field(k) then
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

  resolveHandler = function(name)
    local state = (preState or postState).extendedAstHandlers
    if state.namedHandlers ~= nil then
      return state.namedHandlers[name]
    end
    return nil
  end,


  unbuild = function(extendedAstNode)
    local name = extendedAstNode.attr.attributes["quarto-extended-ast-tag"]
    local handler = quarto.ast.resolveHandler(name)
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
    local handler = quarto.ast.resolveHandler(name)
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

