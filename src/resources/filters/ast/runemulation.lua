-- runemulation.lua
-- run filters in pandoc emulation mode
--
-- Copyright (C) 2022 by RStudio, PBC

local function do_it(doc, filters)
  if tisarray(filters) then
    for _, v in ipairs(filters) do
      local function callback()
        local newDoc = doc:walk(v)
        if newDoc ~= nil then
          doc = newDoc
        end
      end
      if v.scriptFile then
        _quarto.withScriptFile(v.scriptFile, callback)
      else
        callback()
      end
    end
  elseif type(filters) == "table" then
    local newDoc = doc:walk(filters)
    if newDoc ~= nil then
      doc = newDoc
    end
  else
    error("Internal Error: do_it expected a table or array instead of " .. type(filters))
    crash_with_stack_trace()
  end
  return doc
end

local function pandoc_emulated_node_factory(t)
  return function(...)
    local args = { ... }
    -- NB: we can't index into quarto.ast.pandoc in this function
    -- because it's used in the __index metatable of quarto.ast.pandoc
    -- which can cause infinite recursion

    local result = create_emulated_node(t)
    local argsTable = pandoc_constructors_args[t]
    if argsTable == nil then
      for i, v in pairs(args) do
        result[i] = v
      end
    else
      for i, _ in ipairs(argsTable) do
        result[argsTable[i]] = args[i]
      end
    end
    return result
  end
end

function install_pandoc_overrides()
  local state = {}

  state.lua_type = type
  state.walk_block = pandoc.walk_block
  state.walk_inline = pandoc.walk_inline
  state.write = pandoc.write
  state.Inlines = pandoc.Inlines
  state.Blocks = pandoc.Blocks
  state.MetaBlocks = pandoc.MetaBlocks
  state.MetaInlines = pandoc.MetaInlines
  state.pandoc_inlines_mtbl = getmetatable(pandoc.Inlines({}))
  state.pandoc_blocks_mtbl = getmetatable(pandoc.Blocks({}))
  state.utils = pandoc.utils
  state.mediabag = pandoc.mediabag

  local lua_type = type
  local walk_block = state.walk_block
  local walk_inline = state.walk_inline
  local write = state.write
  local Inlines = state.Inlines
  local Blocks = state.Blocks
  local MetaBlocks = state.MetaBlocks
  local MetaInlines = state.MetaInlines
  local pandoc_inlines_mtbl = state.pandoc_inlines_mtbl
  local pandoc_blocks_mtbl = state.pandoc_blocks_mtbl
  local utils = state.utils
  local mediabag = state.mediabag

  type = function(v)
    local lt = lua_type(v)
    -- return lt
    if lt ~= "table" then return lt end
    if v.is_emulated and v.t ~= "Inlines" and v.t ~= "List" and v.t ~= "Blocks" then
      return "userdata"
    end
    return lt
  end
  state.old_utils = {}

  local our_utils = {
    blocks_to_inlines = function(lst)
      return to_emulated(state.old_utils.blocks_to_inlines(from_emulated(lst)))
    end,
    citeproc = function(lst)
      return to_emulated(state.old_utils.citeproc(from_emulated(doc)))
    end,
    make_sections = function(number_sections, base_level, blocks)
      return to_emulated(state.old_utils.make_sections(number_sections, base_level, from_emulated(blocks)))
    end,
    from_simple_table = function(v)
      return to_emulated(state.old_utils.from_simple_table(from_emulated(v)))
    end,
    to_simple_table = function(v)
      return to_emulated(state.old_utils.to_simple_table(from_emulated(v)))
    end,
    references = function(doc)
      return state.old_utils.references(from_emulated(doc))
    end,
    run_json_filter = function(doc, command, arguments)
      return to_emulated(state.old_utils.run_json_filter(from_emulated(doc), command, arguments))
    end,
    stringify = function(v)
      return state.old_utils.stringify(from_emulated(v))
    end,
    type = function(v)
      if v.is_emulated then
        if v.t == "Inlines" then return v.t end
        if v.t == "Blocks" then return v.t end
        if pandoc_is_block[v.t] then return "Block" end
        if pandoc_is_inline[v.t] then return "Inline" end
      else
        return state.old_utils.type(v)
      end
    end
  }

  -- import with this notation before anyone else to avoid
  -- them seeing the naked utils call.
  local pandoc_utils = require 'pandoc.utils'
  for k, v in pairs(our_utils) do
    state.old_utils[k] = pandoc_utils[k]
    pandoc_utils[k] = v
  end

  setmetatable(our_utils, {
    __index = utils
  })

  local our_mediabag = {
    fill = function(doc)
      return to_emulated(mediabag.fill(from_emulated(doc)))
    end
  }

  setmetatable(our_mediabag, {
    __index = mediabag,
  })
  
  local inlines_mtbl = {
    __index = function(tbl, key)
      if key == "t" then return "Inlines" end
      if key == "walk" then return emulate_pandoc_walk end
      if key == "is_emulated" then return true end
      return pandoc_inlines_mtbl.__index[key] -- pandoc_inlines_mtbl.__index is a _table_ (!)
    end,
    __concat = emulated_node_concat,
    __eq = emulated_node_eq,
  }

  setmetatable(inlines_mtbl, {
    __index = function(_, key)
      return pandoc_inlines_mtbl[key]
    end,
  })

  local blocks_mtbl = {
    __index = function(tbl, key)
      if key == "t" then return "Blocks" end
      if key == "walk" then return emulate_pandoc_walk end
      if key == "is_emulated" then return true end
      return pandoc_blocks_mtbl.__index[key] -- pandoc_blocks_mtbl.__index is a _table_ (!)
    end,    
    __concat = emulated_node_concat,
    __eq = emulated_node_eq,
  }

  setmetatable(blocks_mtbl, {
    __index = function(_, key)
      return pandoc_blocks_mtbl[key]
    end,
  })

  local ast_constructors = {}
  state.ast_constructors = ast_constructors

  ast_constructors.Blocks = Blocks
  ast_constructors.Inlines = Inlines
  ast_constructors.MetaBlocks = MetaBlocks
  ast_constructors.MetaInlines = MetaInlines

  pandoc.utils = our_utils

  pandoc.mediabag = our_mediabag
  pandoc.TableBody = function(body, head, row_head_columns, attr)
    return {
      body = body,
      head = head,
      row_head_columns = row_head_columns or 1,
      attr = attr or pandoc.Attr(),
      t = "TableBody"
    }
  end
  pandoc.walk_block = function(el, filter)
    if el.is_emulated then
      return el:walk(filter)
    end
    return walk_block(el, filter)
  end
  pandoc.walk_inline = function(el, filter)
    if el.is_emulated then
      return el:walk(filter)
    end
    return walk_inline(el, filter)
  end
  pandoc.write = function(el, format)
    if el.is_emulated then
      local native = from_emulated(el)
      return write(native, format)
    end
    return write(el, format)
  end
  for k, _ in pairs(pandoc_constructors_args) do
    ast_constructors[k] = pandoc[k]
    pandoc[k] = pandoc_emulated_node_factory(k)
  end
  pandoc.Inlines = function(value)
    local result = {}
    setmetatable(result, inlines_mtbl)

    if value == nil then
      return result
    elseif value.t == "Inlines" or value.t == "List" or (tisarray(value) and not value.is_emulated) then
      result:extend(value)
      return result
    elseif value.t == "Blocks" then
      print("Type error: can't initialize Inlines with Blocks")
      crash_with_stack_trace()
    else
      result:insert(value)
      return result
    end
  end
  pandoc.Blocks = function(value)
    local result = {}
    setmetatable(result, blocks_mtbl)

    if value == nil then
      return result
    elseif value.t == "Blocks" or value.t == "List" or (tisarray(value) and not value.is_emulated) then
      result:extend(value)
      return result
    elseif value.t == "Inlines" then
      print("Type error: can't initialize Blocks with Inlines")
      crash_with_stack_trace()
    else
      result:insert(value)
      return result
    end
  end
  pandoc.MetaBlocks = function(value)
    local is_emulated = value.is_emulated
    if is_emulated then
      return MetaBlocks(quarto.ast.from_emulated(value))
    elseif tisarray(value) then
      return MetaBlocks(tmap(value, quarto.ast.from_emulated))
    else
      return MetaBlocks(value)
    end
  end
  pandoc.MetaInlines = function(value)
    local is_emulated = value.is_emulated
    if is_emulated then
      return MetaInlines(quarto.ast.from_emulated(value))
    elseif tisarray(value) then
      return MetaInlines(tmap(value, quarto.ast.from_emulated))
    else
      return MetaInlines(value)
    end
  end
  quarto.ast._true_pandoc = state.ast_constructors
  return state
end

function restore_pandoc_overrides(state)
  pandoc.utils = state.utils
  for k, v in pairs(state.old_utils) do
    pandoc.utils[k] = state.old_utils[k]
  end

  pandoc.mediabag = state.mediabag
  pandoc.walk_block = state.walk_block
  pandoc.walk_inline = state.walk_inline
  pandoc.write = state.write
  for k, _ in pairs(pandoc_constructors_args) do
    pandoc[k] = state.ast_constructors[k]
  end
  pandoc.Inlines = state.Inlines
  pandoc.Blocks = state.Blocks
  pandoc.MetaInlines = state.MetaInlines
  pandoc.MetaBlocks = state.MetaBlocks
  pandoc.TableBody = state.TableBody -- pretty sure it'll always be nil, but..
  type = state.lua_type
end

local function emulate_pandoc_filter(filters, overrides_state)

  return {
    traverse = 'topdown',
    Pandoc = function(doc)

      doc = to_emulated(doc)
      doc = do_it(doc, filters)
      doc = from_emulated(doc)

      -- the installation happens in main.lua ahead of loaders
      restore_pandoc_overrides(overrides_state)

      -- this call is now a real pandoc.Pandoc call
      return pandoc.Pandoc(doc.blocks, doc.meta), false
    end
  }
end

function run_as_extended_ast(specTable, unextended)
  local pandocFilterList = {}
  if specTable.pre then
    for _, v in ipairs(specTable.pre) do
      table.insert(pandocFilterList, v)
    end
  end

  table.insert(pandocFilterList, emulate_pandoc_filter(specTable.filters, unextended))
  if specTable.post then
    for _, v in ipairs(specTable.post) do
      table.insert(pandocFilterList, v)
    end
  end

  return pandocFilterList
end