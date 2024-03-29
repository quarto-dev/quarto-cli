-- scopedwalk.lua
-- 
-- Copyright (C) 2024 Posit Software, PBC

-- unlike Pandoc's walk, this will mutate the nodes in place!
function scoped_walk(outer_node, filter)
  local function node_type(node)
    local pt = pandoc.utils.type(node)
    if pt == "Block" or pt == "Inline" then
      return node.t
    end
    return pt
  end

  local scope = pandoc.List({})
  -- needs to be defined here to allow corecursion
  local inner
  local function process_handler(handler, node)
    -- skip special nodes that should never be seen by filters
    if node.attributes and node.attributes.__quarto_custom_scaffold == "true" or
      node.identifier == _quarto.ast.vault._uuid then
      return nil, false
    end

    if handler then
      local result, recurse = handler(node, scope)
      if recurse == false then
        return result, true
      end
      if result ~= nil then
        scope:remove() -- scope is removed first here because `node` became `result`
        result = inner(result)
        scope:insert(nil) -- a dummy value to keep the scope management consistent
        return result, true
      end
    end
    return nil, false
  end  
  local function process_blocks(blocks)
    local result, done = process_handler(filter.Blocks, blocks)
    if done then
      return result or blocks
    end
    assert(result == nil)
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
          n = n - 1
          for ii, inner_block in ipairs(inner_r) do
            blocks:insert(i, inner_block)
            i = i + 1
            n = n + 1
          end
        elseif inner_nt == "Inlines" then
          blocks:remove(i)
          n = n - 1
          if #inner_nt > 0 then
            blocks[i] = pandoc.Plain(inner_r)
            i = i + 1
            n = n + 1
          end
        elseif inner_nt == "table" then
          blocks:remove(i)
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
    return blocks
  end
  local function process_inlines(inlines)
    local result, done = process_handler(filter.Inlines, inlines)
    if done then
      return result or inlines
    end
    assert(result == nil)
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
          n = n - 1
          for ii, inner_block in ipairs(inner_r) do
            inlines:insert(i, inner_block)
            i = i + 1
            n = n + 1
          end
        elseif inner_nt == "table" then
          inlines:remove(i)
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
    return inlines
  end
  local has_only_blocks_content = {
    BlockQuote = true,
    Div = true,
    Note = true,
  }
  local has_only_inlines_content = {
    Plain = true,
    Para = true,
    Span = true,
    Header = true,
    Emph = true,
    Strong = true,
    Strikeout = true,
    Subscript = true,
    Superscript = true,
    SmallCaps = true,
    Quoted = true,
    Link = true,
    Underline = true,
  }
  local terminals = {
    Str = true,
    Space = true,
    SoftBreak = true,
    LineBreak = true,
    Code = true,
    Math = true,
    RawInline = true,
    CodeBlock = true,
    RawBlock = true,
    HorizontalRule = true,
    Null = true,
  }
  local function process_caption(caption)
    if caption.long then
      caption.long = process_blocks(caption.long)
    end
    if caption.short then
      caption.short = process_inlines(caption.short)
    end
  end
  local function process_content(node)
    local nt = node_type(node)
    
    -- recurse on the result or node's inner nodes
    if has_only_blocks_content[nt] then
      node.content = process_blocks(node.content)
      return node
    end
    if has_only_inlines_content[nt] then
      node.content = process_inlines(node.content)
      return node
    end
    if terminals[nt] then
      return node
    end
    -- now for the myriad special cases
    if nt == "Image" then
      node.caption = process_inlines(node.caption)
      return node
    end
    if nt == "BulletList" or nt == "OrderedList" then
      for i, c in ipairs(node.content) do
        node.content[i] = process_blocks(c)
      end
      return node
    end
    if nt == "Table" then
      local function process_list_of_rows(rows)
        for i, r in ipairs(rows) do
          for j, c in ipairs(r.cells) do
            c.content = process_blocks(c.content)
          end
        end
      end
      process_caption(node.caption)
      process_list_of_rows(node.head.rows)
      for i, b in ipairs(node.bodies) do
        process_list_of_rows(b.head)
        process_list_of_rows(b.body)
      end
      process_list_of_rows(node.foot.rows)
      return node
    end
    if nt == "DefinitionList" then
      for i, c in ipairs(node.content) do
        c[1] = process_inlines(c[1])
        for j, cc in ipairs(c[2]) do
          c[2][j] = process_blocks(cc)
        end
      end
      return node
    end
    if nt == "Figure" then
      process_caption(node.caption)
      node.content = process_blocks(node.content)
      return node
    end
    if nt == "LineBlock" then
      for i, c in ipairs(node.content) do
        node.content[i] = process_inlines(c)
      end
      return node
    end
    if nt == "Cite" then
      node.content = process_inlines(node.content)
      for i, c in ipairs(node.citations) do
        c.prefix = process_inlines(c.prefix)
        c.suffix = process_inlines(c.suffix)
      end
      return node
    end

    -- else
      quarto.utils.dump(node)
      fail("unexpected node type in handling content: " .. nt)
    -- end

    -- local ct = pandoc.utils.type(content)
    -- if ct == "Blocks" then
    --   process_blocks(content)
    -- elseif ct == "Inlines" then
    --   process_inlines(content)
    -- elseif ct == "List" then
    --   for i, c in ipairs(content) do
    --     local cct = pandoc.utils.type(c)
    --     if cct == "Blocks" then
    --       process_blocks(content)
    --     elseif cct == "Inlines" then
    --       process_inlines(content)
    --     else
    --       quarto.utils.dump(content)
    --       fail("unexpected node type in Block or Inline content: " .. cct)
    --     end
    --   end
    --   fail("unexpected node type in Block or Inline content: " .. cct)
    -- end
  end

  local function process_custom(node)
    local t = node.attributes.__quarto_custom_type
    local result, done = process_handler(filter[t] or filter.Custom, node)
    if done then
      return result
    end
    process_content(node)
    return node
  end
  local function process_block_or_inline(node, nt)
    local result, done = process_handler(filter[node.t] or filter[nt], node)
    if done then
      return result
    end
    process_content(node)
    return node
  end

  inner = function(node)
    scope:insert(node)
    local nt = pandoc.utils.type(node)
    local result
    if is_custom_node(node) then
      result = process_custom(node)
    elseif nt == "Block" or nt == "Inline" then
      result = process_block_or_inline(node, nt)
    elseif nt == "Blocks" then
      result = process_blocks(node)
    elseif nt == "Inlines" then
      result = process_inlines(node)
    else
      fail("unexpected node type: " .. nt)
    end

    scope:remove()
    return result
  end

  return inner(outer_node)
end