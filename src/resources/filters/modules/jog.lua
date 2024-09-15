--- jog.lua – walk the pandoc AST with context, and with inplace modification.
---
--- Copyright: © 2024 Albert Krewinkel, Carlos Scheidegger
--- License: MIT – see LICENSE for details

local pandoc = require 'pandoc'
local List   = require 'pandoc.List'

local debug_getmetatable = debug.getmetatable

--- Get the element type; like pandoc.utils.type, but faster.
local function ptype (x)
  local mt = debug_getmetatable(x)
  if mt then
    local name = mt.__name
    return name or type(x)
  else
    return type(x)
  end
end

--- Checks whether the object is a list type.
local listy_type = {
  Blocks = true,
  Inlines = true,
  List = true,
}

local function run_filter_function (fn, element, context)
  if fn == nil then
    return element
  end

  local result, continue = fn(element, context)
  if result == nil then
    return element, continue
  else
    return result, continue
  end
end

--- Set of Block and Inline tags that are leaf nodes.
local leaf_node_tags = {
  Code = true,
  CodeBlock = true,
  HorizontalRule = true,
  LineBreak = true,
  Math = true,
  RawBlock = true,
  RawInline = true,
  Space = true,
  SoftBreak = true,
  Str = true,
}

--- Set of Block and Inline tags that have nested items in `.contents` only.
local content_only_node_tags = {
  -- Blocks with Blocks content
  BlockQuote = true,
  Div = true,
  Header = true,
  -- Blocks with Inlines content
  Para = true,
  Plain = true,
  -- Blocks with List content
  LineBlock = true,
  BulletList = true,
  OrderedList = true,
  DefinitionList = true,
  -- Inlines with Inlines content
  Cite = true,
  Emph = true,
  Link = true,
  Quoted = true,
  SmallCaps = true,
  Span = true,
  Strikeout = true,
  Strong = true,
  Subscript = true,
  Superscript = true,
  Underline = true,
  -- Inline with Blocks content
  Note = true,
}

--- Apply the filter on the nodes below the given element.
local function recurse (element, tp, jogger)
  tp = tp or ptype(element)
  local tag = element.tag
  if leaf_node_tags[tag] then
    -- do nothing, cannot traverse any deeper
  elseif tp == 'table' then
    for key, value in pairs(element) do
      element[key] = jogger(value)
    end
  elseif content_only_node_tags[tag] or tp == 'pandoc Cell' then
    element.content = jogger(element.content)
  elseif tag == 'Image' then
    element.caption = jogger(element.caption)
  elseif tag == 'Table' then
    element.caption = jogger(element.caption)
    element.head    = jogger(element.head)
    element.bodies  = jogger(element.bodies)
    element.foot    = jogger(element.foot)
  elseif tag == 'Figure' then
    element.caption = jogger(element.caption)
    element.content = jogger(element.content)
  elseif tp == 'Meta' then
    for key, value in pairs(element) do
      element[key] = jogger(value)
    end
  elseif tp == 'pandoc Row' then
    element.cells    = jogger(element.cells)
  elseif tp == 'pandoc TableHead' or tp == 'pandoc TableFoot' then
    element.rows    = jogger(element.rows)
  elseif tp == 'Blocks' or tp == 'Inlines' then
    local expected_itemtype = tp == 'Inlines' and 'Inline' or 'Block'
    local pos = 0
    local filtered_index = 1
    local filtered_items = element:map(function (x)
        return jogger(x)
    end)
    local item = filtered_items[filtered_index]
    local itemtype
    while item ~= nil do
      itemtype = ptype(item)
      if itemtype ~= tp and itemtype ~= expected_itemtype then
        -- neither the list type nor the list's item type. Try to convert.
        item = pandoc[tp](item)
        itemtype = tp
      end
      if itemtype == tp then
        local sublist_index = 1
        local sublistitem = item[sublist_index]
        while sublistitem ~= nil do
          pos = pos + 1
          element[pos]  = sublistitem
          sublist_index = sublist_index + 1
          sublistitem   = item[sublist_index]
        end
      else
        -- not actually a sublist, just an element
        pos = pos + 1
        element[pos] = item
      end
      filtered_index = filtered_index + 1
      item = filtered_items[filtered_index]
    end
    -- unset remaining indices if the new list is shorter than the old
    pos = pos + 1
    while element[pos] do
      element[pos] = nil
      pos = pos + 1
    end
  elseif tp == 'List' then
    local i, item = 1, element[1]
    while item do
      element[i] = jogger(item)
      i, item = i+1, element[i+1]
    end
  elseif tp == 'Pandoc' then
    element.meta = jogger(element.meta)
    element.blocks = jogger(element.blocks)
  else
    error("Don't know how to traverse " .. (element.t or tp))
  end
  return element
end

local non_joggable_types = {
  ['Attr'] = true,
  ['boolean'] = true,
  ['nil'] = true,
  ['number'] = true,
  ['string'] = true,
}

local function get_filter_function(element, filter, tp)
  local result = nil
  if non_joggable_types[tp] or tp == 'table' then
    return nil
  elseif tp == 'Block' then
    return filter[element.tag] or filter.Block
  elseif tp == 'Inline' then
    return filter[element.tag] or filter.Inline
  else
    return filter[tp]
  end
end

local function make_jogger (filter, context)
  local is_topdown = filter.traverse == 'topdown'
  local jogger

  jogger = function (element)
    if context then
      context:insert(element)
    end
    local tp = ptype(element)
    local result, continue = nil, true
    if non_joggable_types[tp] then
      result = element
    elseif tp == 'table' then
      result = recurse(element, tp, jogger)
    else
      local fn = get_filter_function(element, filter, tp)
      if is_topdown then
        result, continue = run_filter_function(fn, element, context)
        if continue ~= false then
          result = recurse(result, tp, jogger)
        end
      else
        element = recurse(element, tp, jogger)
        result = run_filter_function(fn, element, context)
      end
    end

    if context then
      context:remove() -- remove this element from the context
    end
    return result
  end
  return jogger
end

local element_name_map = {
  Cell = 'pandoc Cell',
  Row = 'pandoc Row',
  TableHead = 'pandoc TableHead',
  TableFoot = 'pandoc TableFoot',
}

--- Function to traverse the pandoc AST with context.
local function jog(element, filter)
  local context = filter.context and List{} or nil

  -- Table elements have a `pandoc ` prefix in the name
  for from, to in pairs(element_name_map) do
    filter[to] = filter[from]
  end

  -- Check if we can just call Pandoc and Meta and be done
  if ptype(element) == 'Pandoc' then
    local must_recurse = false
    for name in pairs(filter) do
      if name:match'^[A-Z]' and name ~= 'Pandoc' and name ~= 'Meta' then
        must_recurse = true
        break
      end
    end
    if not must_recurse then
      element.meta = run_filter_function(filter.Meta, element.meta, context)
      element = run_filter_function(filter.Pandoc, element, context)
      return element
    end
  end

  if _QUARTO_USE_WALK then
    return element:walk(filter)
  end

  -- Create and call traversal function
  local jog_internal = make_jogger(filter, context)
  return jog_internal(element)
end

--- Add `jog` as a method to all pandoc AST elements
-- This uses undocumented features and might break!
local function add_method(funname)
  funname = funname or 'jog'
  pandoc.Space()          -- init metatable 'Inline'
  pandoc.HorizontalRule() -- init metatable 'Block'
  pandoc.Meta{}           -- init metatable 'Pandoc'
  pandoc.Pandoc{}         -- init metatable 'Pandoc'
  pandoc.Blocks{}         -- init metatable 'Blocks'
  pandoc.Inlines{}        -- init metatable 'Inlines'
  pandoc.Cell{}           -- init metatable 'pandoc Cell'
  pandoc.Row{}            -- init metatable 'pandoc Row'
  pandoc.TableHead{}      -- init metatable 'pandoc TableHead'
  pandoc.TableFoot{}      -- init metatable 'pandoc TableFoot'
  local reg = debug.getregistry()
  List{
    'Block', 'Inline', 'Pandoc',
    'pandoc Cell', 'pandoc Row', 'pandoc TableHead', 'pandoc TableFoot'
  }:map(
    function (name)
      if reg[name] then
        reg[name].methods[funname] = jog
      end
    end
       )
  for name in pairs(listy_type) do
    if reg[name] then
      reg[name][funname] = jog
    end
  end
  if reg['Meta'] then
    reg['Meta'][funname] = jog
  end
end

local mt = {
  __call = function (_, ...)
    return jog(...)
  end
}

local M = setmetatable({}, mt)
M.jog = jog
M.add_method = add_method

return M
