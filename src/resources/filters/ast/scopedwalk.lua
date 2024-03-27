-- scopedwalk.lua
-- 
-- Copyright (C) 2024 Posit Software, PBC

-- unlike Pandoc's walk, this will mutate the nodes in place!
function scoped_walk(outer_node, filter)
  local context = pandoc.List({})
  -- needs to be defined here to allow corecursion
  local inner
  local function process_blocks(blocks)
    local i = 1
    local n = #blocks
    while i <= n do
      local block = blocks[i]
      local inner_r, rec = inner(block)
      if inner_r ~= nil then
        local inner_nt = pandoc.utils.type(inner_r)
        if inner_nt == "Block" then
          blocks[i] = inner_r
        elseif inner_nt == "Inline" then
          blocks[i] = pandoc.Plain(inner_r)
        elseif inner_nt == "Blocks" then
          blocks:remove(i)
          i = i - 1
          n = n - 1
          for ii, inner_block in ipairs(inner_r) do
            blocks:insert(i, inner_block)
            i = i + 1
            n = n + 1
          end
        elseif inner_nt == "Inlines" then
          blocks:remove(i)
          i = i - 1
          n = n - 1
          if #inner_nt > 0 then
            blocks[i] = pandoc.Plain(inner_r)
            i = i + 1
            n = n + 1
          end
        elseif inner_nt == "table" then
          blocks:remove(i)
          i = i - 1
          n = n - 1
          for ii, inner_block in ipairs(inner_r) do
            local inner_block_nt = pandoc.utils.type(inner_block)
            if inner_block_nt == "Block" then
              blocks:insert(i, inner_block)
            elseif inner_block_nt == "Inline" then
              blocks:insert(i, pandoc.Plain(inner_block))
            else
              fail("unexpected node type in table while adding to Blocks: " .. inner_block_nt)
            end
            i = i + 1
            n = n + 1
          end
        else
          fail("unexpected node type while handling blocks: " .. inner_nt)
        end
      end
      i = i + 1
    end
  end
  local function process_inlines(inlines)
    local i = 1
    local n = #inlines
    while i <= n do
      local block = inlines[i]
      local inner_r, rec = inner(block)
      if inner_r ~= nil then
        local inner_nt = pandoc.utils.type(inner_r)
        if inner_nt == "Inline" then
          inlines[i] = inner_r
        elseif inner_nt == "Block" then
          fail("unexpected block found in inlines")
        elseif inner_nt == "Blocks" then
          fail("unexpected blocks found in inlines")
        elseif inner_nt == "Inlines" then
          inlines:remove(i)
          i = i - 1
          n = n - 1
          for ii, inner_block in ipairs(inner_r) do
            inlines:insert(i, inner_block)
            i = i + 1
            n = n + 1
          end
        elseif inner_nt == "table" then
          inlines:remove(i)
          i = i - 1
          n = n - 1
          for ii, inner_block in ipairs(inner_r) do
            local inner_block_nt = pandoc.utils.type(inner_block)
            if inner_block_nt == "Inline" then
              inlines:insert(i, pandoc.Plain(inner_block))
            else
              fail("unexpected node type in table while adding to Inlines: " .. inner_block_nt)
            end
            i = i + 1
            n = n + 1
          end
        else
          fail("unexpected node type while handling inlines: " .. inner_nt)
        end
      end
      i = i + 1
    end
  end
  local function process_content(content)
    -- recurse on the result or node's inner nodes
    local ct = pandoc.utils.type(content)
    if ct == "Blocks" then
      process_blocks(content)
    elseif ct == "Inlines" then
      process_inlines(content)
    else
      fail("unexpected node type in Block or Inline content: " .. ct)
    end
  end
  local function process_handler(handler, node)
    -- skip special nodes that should never be seen by filters
    if node.attributes.__quarto_custom_scaffold == "true" or
      node.identifier == _quarto.ast.vault._uuid then
      return nil, false
    end

    if handler then
      local result, recurse = handler(node, context)
      if recurse == false then
        context:remove()
        return result, true
      end
      if result ~= nil then
        context:remove() -- context is removed first here because `node` became `result`
        return inner(result), true
      end
    end
    return nil, false
  end

  inner = function(node)
    context:insert(node)
    local nt = pandoc.utils.type(node)
    if is_custom_node(node) then
      local t = node.attributes.__quarto_custom_type
      local result, done = process_handler(filter[t] or filter.Custom, node)
      if done then
        -- if done, process_handler has already removed the node from the context
        return result
      end
      process_content(node.content)
    elseif nt == "Block" or nt == "Inline" then
      local result, done = process_handler(filter[node.t] or filter[nt], node)
      if done then
        -- if done, process_handler has already removed the node from the context
        return result
      end
      process_content(node.content)
    elseif nt == "Blocks" then
      local result, done = process_handler(filter[nt], node)
      if done then
        -- if done, process_handler has already removed the node from the context
        return result
      end
      process_blocks(node)
    elseif nt == "Inlines" then
      local result, done = process_handler(filter[nt], node)
      if done then
        -- if done, process_handler has already removed the node from the context
        return result
      end
      process_inlines(node)
    else
      fail("unexpected node type: " .. nt)
    end

    context:remove()
    return node
  end

  return inner(outer_node)
end