-- definitionlist.lua
-- Copyright (C) 2026 Posit Software, PBC

-- Div-based definition lists, the syntax Quarto 2 uses in place of
-- Pandoc's `Term\n: Definition` syntax:
--
-- ::: {.definition-list}
-- * Term 1
--   - Definition 1a
--   - Definition 1b
-- * Term 2
--   - Definition 2
-- :::
--
-- A div with the `definition-list` class becomes a DefinitionList when
-- it contains exactly one bullet list, and each item of that list holds
-- exactly two blocks: the term (a Plain or Para), and a nested bullet
-- list whose items are the term's definitions.
--
-- This matches Quarto 2's rules (`is_valid_definition_list_div` and
-- `transform_definition_list_div` in pampa): a div that doesn't have this
-- shape is left alone, and the div's own attributes are dropped because
-- Pandoc's DefinitionList has no Attr.

-- Skip data-pos Divs inserted by the sourcepos extension
local function block_skip_data_pos(block)
  if (block.t == "Div" and block.attr.attributes["data-pos"]) then
    block = block.content[1]
  end
  return block
end

local function blocks_skip_data_pos(blocks)
  local new_blocks = pandoc.Blocks({})
  for _, block in ipairs(blocks) do
    new_blocks:insert(block_skip_data_pos(block))
  end
  return new_blocks
end

-- Returns the outer bullet list when `div` has the definition-list
-- shape, nil otherwise.
local function definition_list_shape(div)
  local content = blocks_skip_data_pos(div.content)
  if #content ~= 1 or content[1] == nil or content[1].t ~= "BulletList" then
    return nil
  end
  local list = content[1]
  for _, item in ipairs(list.content) do
    local blocks = blocks_skip_data_pos(item)
    if #blocks ~= 2 then
      return nil
    end
    local term = blocks[1]
    if term == nil or (term.t ~= "Plain" and term.t ~= "Para") then
      return nil
    end
    if blocks[2] == nil or blocks[2].t ~= "BulletList" then
      return nil
    end
  end
  return list
end

local function process(div)
  if not div.attr.classes:includes("definition-list") then
    return nil
  end
  local list = definition_list_shape(div)
  if list == nil then
    return nil
  end

  local items = pandoc.List({})
  for _, item in ipairs(list.content) do
    local blocks = blocks_skip_data_pos(item)
    local term = blocks[1].content
    local definitions = pandoc.List({})
    for _, definition in ipairs(blocks[2].content) do
      definitions:insert(blocks_skip_data_pos(definition))
    end
    items:insert({term, definitions})
  end
  return pandoc.DefinitionList(items)
end

return {
  definition_list_filter = function()
    return {Div = process}
  end
}
