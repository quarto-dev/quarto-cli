-- coalesceraw.lua
-- coalesces sequences of rawblock and rawinline nodes.
--
-- Copyright (C) 2023 Posit Software, PBC
--
-- Raw blocks are selectively coalesced if they're written
-- to:
--    - the same format
--    - with a suffix of -merge
--
-- This specifically matters in the case of some latex rawblocks which
-- cannot be separated by a newline (like minipages in a figure)
--
-- note that in LaTeX output, we need to strip Div nodes, since they
-- can "delimit" two raw blocks and prevent them from being coalesced.

function coalesce_raw() 
  local filters = {}
  if quarto.doc.isFormat("latex") then
    -- flatten out divs before merging raw blocks
    table.insert(filters, {
      Div = function(div)
        return div.content
      end
    })
  end
  
  table.insert(filters, {
    Inlines = function(inlines)
      local list_of_lists = collate(inlines, function(block, prev_block)
        return block.t == "RawInline" and 
              prev_block.t == "RawInline" and prev_block.format == block.format
      end)
      local result = pandoc.Inlines({})
      for _, lst in ipairs(list_of_lists) do
        local first_el = lst[1]
        if first_el.t == "RawInline" then
          local text = table.concat(lst:map(function(block) return block.text end), "")
          local new_block = pandoc.RawInline(first_el.format, text)
          result:insert(new_block)
        else
          result:insert(first_el)
        end
      end
      return result
    end,
    Blocks = function(blocks)
      local list_of_lists = collate(blocks, function(block, prev_block)
        return block.t == "RawBlock" and block.format:match(".*-merge$") and 
              prev_block.t == "RawBlock" and prev_block.format == block.format
      end)
      local result = pandoc.Blocks({})
      for _, lst in ipairs(list_of_lists) do
        local first_el = lst[1]
        if first_el.t == "RawBlock" and first_el.format:match(".*-merge") then
          local text = table.concat(lst:map(function(block) return block.text end), "%\n")
          local new_block = pandoc.RawBlock(first_el.format:gsub("-merge$", ""), text)
          result:insert(new_block)
        else
          result:insert(first_el)
        end
      end
      return result
    end
  })
  return filters
end