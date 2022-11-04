-- pandocwalk.lua
-- emulate the walk method for our extended ast
--
-- Copyright (C) 2022 by RStudio, PBC

-- We base this emulation on the original Haskell source:
--   https://github.com/pandoc/pandoc-lua-marshal

local apply_filter_bottomup
local apply_filter_topdown

local function ast_node_property_pairs(node)
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

local function as_emulated(n)
  if type(n) == "userdata" and not n.is_emulated then
    return to_emulated(n)
  end
  return n
end

local function ast_node_array_map(node_array, fn)
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

local function is_ast_node_array(tbl)
  if type(tbl) ~= "table" then
    return false
  end
  if tbl.t ~= nil then
    return false
  end
  return tisarray(tbl)
end

local function apply_filter_topdown_blocks_or_inlines(filter, blocks_or_inlines)
  local t = blocks_or_inlines.t
  local filterFn = filter[t]
  if filterFn ~= nil then
    local filterResult, cut = filterFn(blocks_or_inlines)
    if filterResult ~= nil then
      blocks_or_inlines = ast_node_array_map(filterResult, as_emulated)
    end
    if cut == false then
      return blocks_or_inlines
    end
  end

  local result = create_emulated_node(t)
  for k, v in pairs(blocks_or_inlines) do
    if is_content_field(k) then
      local filterResult = apply_filter_topdown(filter, v)
      if filterResult == nil then
        -- nil means unchanged object
        table.insert(result, v)
      elseif is_ast_node_array(filterResult) then
        -- array of results: splice those in.
        -- this includes empty array, which means "remove me"
        for _, innerV in ast_node_property_pairs(filterResult) do
          table.insert(result, as_emulated(innerV))
        end
      else
        -- changed object, use that instead
        table.insert(result, as_emulated(filterResult))
      end          
    end
  end
  return result  
end

local function apply_filter_bottomup_blocks_or_inlines(filter, blocks_or_inlines)
  local t = blocks_or_inlines.t or pandoc.utils.type(blocks_or_inlines)
  local filterFn = filter[t]
  if filterFn ~= nil then
    local filterResult = filterFn(blocks_or_inlines)
    if filterResult ~= nil then
      blocks_or_inlines = ast_node_array_map(filterResult, as_emulated)
    end
  end

  local result = create_emulated_node(t)
  for k, v in pairs(blocks_or_inlines) do
    if is_content_field(k) then
      local filterResult = apply_filter_bottomup(filter, v)
      if filterResult == nil then
        -- nil means unchanged object
        result:insert(v)
      elseif is_ast_node_array(filterResult) then
        -- array of results: splice those in.
        -- this includes empty array, which means "remove me"
        for _, innerV in ast_node_property_pairs(filterResult) do
          result:insert(as_emulated(innerV))
        end
      else
        -- changed object, use that instead
        result:insert(as_emulated(filterResult))
      end          
    end
  end
  return result  
end

-- from https://www.lua.org/pil/2.html
local is_atom = {
  ["number"] = true,
  ["nil"] = true,
  ["function"] = true,
  ["boolean"] = true,
  ["string"] = true, -- technically not true, but true for our purposes
  -- userdata
  -- thread?!?!
}

-- this function returns nil if the node is unchanged
apply_filter_bottomup = function(filter, node)
  local nodeType = type(node)
  if is_atom[nodeType] then
    return nil
  end

  local t = node.t
  local pandocT = pandoc.utils.type(node)
  -- process non-emulated lists
  if not node.is_emulated then
    if pandocT == "Blocks" or pandocT == "Inlines" then
      return apply_filter_bottomup_blocks_or_inlines(filter, node)
    end
    if pandocT == "List" then
      local result = pandoc.List()
      result:extend(tmap(node, function(n) 
        return apply_filter_bottomup(filter, n) or n end
      ))
      return result
    end
    -- other non-emulated nodes are handled below
    -- by converting them to emulated nodes.
  end

  if t == nil then
    if tisarray(node) then
      return tmap(node, function(n) 
        return apply_filter_bottomup(filter, n) or n end
      )
    else
      -- TableBody, smh
      local result = {}
      for k, v in pairs(node) do
        result[k] = apply_filter_bottomup(filter, v) or v
      end
      return result
    end
  end
  if t == "Attr" then
    return nil
  end

  -- walk children
  if type(node) == "userdata" then
    -- we can only emulate walks on emulated nodes
    node = as_emulated(node)
  end

  local newResult = {}
  local result = node
  local changed = false
  if result.is_custom then
    local handler = quarto.ast.resolve_handler(t)
    local custom_changed = false
    if handler ~= nil and handler.inner_content ~= nil then
      local inner_content = handler.inner_content(result)
      local new_inner_content = {}
      for inner_content_k, inner_content_v in pairs(inner_content) do
        local new_inner_content_v = {}
        local inner_changed = false
        for _, v in ipairs(inner_content_v) do
          local new_v = apply_filter_bottomup(filter, v)
          if new_v ~= nil then
            inner_changed = true
            table.insert(new_inner_content_v, new_v)
          else
            table.insert(new_inner_content_v, v)
          end
        end
        if inner_changed then
          new_inner_content[inner_content_k] = new_inner_content_v
          custom_changed = true
        end
      end
      if custom_changed then
        changed = true
        result = result:clone()
        if handler ~= nil and handler.set_inner_content ~= nil then
          handler.set_inner_content(result, new_inner_content)
        end
      end
    end
  else
    local ast_node_changed = false
    for k, v in ast_node_property_pairs(result) do
      local newV = apply_filter_bottomup(filter, v)
      if newV ~= nil then
        ast_node_changed = true
        newResult[k] = newV
      end
    end
    if ast_node_changed then
      changed = true
      result = result:clone()
      for k, v in pairs(newResult) do
        result[k] = v
      end
    end
  end

  local fn = (filter[t] 
    or filter[node.is_custom and "Custom"] -- explicit check needed for Meta :facepalm:
    or filter[(pandoc_is_block[t] and "Block") or "Inline"])

  if fn == nil then
    if changed then
      return result
    else
      return nil
    end
  end

  local filterResult = fn(result)

  if filterResult == nil then
    if changed then
      return result
    else
      return nil
    end
  elseif is_ast_node_array(filterResult) then
    return ast_node_array_map(filterResult, as_emulated)
  else
    return as_emulated(filterResult)
  end
end

-- declared as local on top
apply_filter_topdown = function(filter, node)
  local nodeType = type(node)
  if is_atom[nodeType] then
    return node
  end
  local t = node.t

  if t == "Blocks" or t == "Inlines" then
    local result = apply_filter_topdown_blocks_or_inlines(filter, node)
    return result
  end 

  -- are there user filter functions or fallback functions?
  local fn = (filter[t] 
    or filter[node.is_custom and "Custom"] -- explicit check needed for Meta :facepalm:
    or filter[(pandoc_is_block[t] and "Block") or "Inline"])
  
  if fn ~= nil then
    local filterResult, cut = fn(node)
  
    -- if filter function returned false as second value, we cut
    -- short the traverse
    if cut == false then
      -- if filter function returned an actual pandoc object in their filters,
      -- we allow that and reemulate it before continuing.
      if filterResult == nil then
        return node
      elseif is_ast_node_array(filterResult) then
        return ast_node_array_map(filterResult, as_emulated)
      else
        return as_emulated(filterResult)
      end
    end

    -- if filter function returned an array, we recurse
    -- and return the array
    if is_ast_node_array(filterResult) then
      -- if filter function returned an actual pandoc object in their filters,
      -- we allow that and reemulate it before continuing.
      return ast_node_array_map(filterResult, function(innerNode)
        return apply_filter_topdown(filter, as_emulated(innerNode)) 
      end)
    end

    -- if filter function returned a value, replace original node
    if filterResult ~= nil then
      node = as_emulated(filterResult)
      if is_atom[type(node)] then
        return node
      end
      t = node and node.t
    end
  end

  -- as a totally hacky special case, we bail out on regular tables
  -- which appear from our Meta handling.
  -- FIXME we need to fix meta handling
  if node.clone == nil then
    return node
  end

  -- now we recurse on the node, either new or old
  local result = node:clone()
  for k, v in ast_node_property_pairs(result) do
    result[k] = apply_filter_topdown(filter, v)
  end
  return result
end

local function walk_inline_splicing(filter, node)
  return apply_filter_bottomup({
    Inlines = function(inlines)
      local result = pandoc.Inlines()
      for _, inline in ipairs(inlines) do
        local filterFn = pandoc_is_inline[inline.t] and (filter[inline.t] or filter.Inline)
        local filterResult = filterFn and filterFn(inline)
        if filterResult == nil then
          result:insert(inline)
        elseif is_ast_node_array(filterResult) or filterResult.t == "Inlines" then
          result:extend(filterResult)
        else
          result:insert(filterResult)
        end
      end
      return result
    end,
  }, node) or node
end

local function walk_block_splicing(filter, node)
  return apply_filter_bottomup({
    Blocks = function(blocks)
      local result = pandoc.Blocks()
      for _, block in ipairs(blocks) do
        local filterFn = pandoc_is_block[block.t] and (filter[block.t] or filter.Block)
        local filterResult = filterFn and filterFn(block)
        if filterResult == nil then
          result:insert(block)
        elseif is_ast_node_array(filterResult) or filterResult.t == "Blocks" then
          result:extend(filterResult)
        else
          result:insert(filterResult)
        end
      end
      return result
    end,
  }, node) or node
end

local function walk_custom_splicing(filter, node)
  return apply_filter_bottomup({
    Blocks = function(blocks)
      local result = pandoc.Blocks()
      for _, custom in ipairs(blocks) do
        local filterFn = custom.is_custom and (filter[custom.t] or filter.Custom)
        local filterResult = filterFn and filterFn(custom)
        if filterResult == nil then
          result:insert(custom)
        elseif is_ast_node_array(filterResult) or filterResult.t == "Blocks" then
          result:extend(filterResult)
        else
          result:insert(filterResult)
        end
      end
      return result
    end,
    Inlines = function(inlines)
      local result = pandoc.Inlines()
      for _, custom in ipairs(inlines) do
        local filterFn = custom.is_custom and (filter[custom.t] or filter.Custom)
        local filterResult = filterFn and filterFn(custom)
        if filterResult == nil then
          result:insert(custom)
        elseif is_ast_node_array(filterResult) or filterResult.t == "Inlines" then
          result:extend(filterResult)
        else
          result:insert(filterResult)
        end
      end
      return result
    end,
  }, node) or node
end

local function walk_inlines_straight(filter, node)
  -- it's a nop, special-case it
  if filter.Inlines == nil then
    return node
  end
  return apply_filter_bottomup({
    Inlines = function(inlines)
      return apply_filter_bottomup_blocks_or_inlines({
        Inlines = function(inlines)
          return filter.Inlines(inlines)
        end
      }, inlines)
    end
  }, node) or node
end

local function walk_blocks_straight(filter, node)
  -- it's a nop, special-case it
  if filter.Blocks == nil then
    return node
  end
  return apply_filter_bottomup({
    Blocks = function(blocks)
      return apply_filter_bottomup_blocks_or_inlines({
        Blocks = function(blocks)
          return filter.Blocks(blocks)
        end
      }, blocks)
    end
  }, node) or node
end

-- pandoc-lua-marshal/src/Text/Pandoc/Lua/Marshal/Shared.hs:walkBlocksAndInlines
local function walk_blocks_and_inlines(node, filter)
  -- walkBlocksAndInlines filter' =
  -- case filterWalkingOrder filter' of
  --   WalkTopdown     -> walkM (applyFilterTopdown filter')
  --   WalkForEachType -> walkInlineSplicing filter'
  --                  >=> walkInlinesStraight filter'
  --                  >=> walkBlockSplicing filter'
  --                  >=> walkBlocksStraight filter'

  if filter.traverse == "topdown" then
    return apply_filter_topdown(filter, node)
  else
    node = walk_inline_splicing(filter, node)
    node = walk_inlines_straight(filter, node)
    node = walk_block_splicing(filter, node)
    node = walk_blocks_straight(filter, node)
    node = walk_custom_splicing(filter, node)
    return node
  end
end

local function apply_meta_function(doc, filter)
  if filter.Meta and doc.t == "Pandoc" then
    local filterResult = filter.Meta(doc.meta)
    if filterResult ~= nil then
      doc = doc:clone()
      doc.meta = filterResult
    end
  end
  return doc
end

local function apply_pandoc_function(doc, filter)
  if filter.Pandoc and doc.t == "Pandoc" then
    doc = filter.Pandoc(doc) or doc
  end
  return doc
end

local function apply_fully(filter, doc)
  -- pandoc-lua-marshal/src/Text/Pandoc/Lua/Marshal/Pandoc.hs:applyFully
  if filter.traverse == "topdown" then
    doc = apply_pandoc_function(doc, filter)
    doc = apply_meta_function(doc, filter)
    doc = walk_blocks_and_inlines(doc, filter)
  else -- typewise
    doc = walk_blocks_and_inlines(doc, filter)
    doc = apply_meta_function(doc, filter)
    doc = apply_pandoc_function(doc, filter)
  end
  return doc
end

function emulate_pandoc_walk(node, filter)
  return apply_fully(filter, node)
end