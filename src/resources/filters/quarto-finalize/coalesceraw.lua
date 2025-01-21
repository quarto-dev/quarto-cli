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
        -- only flatten out divs that have no classes or attributes
        -- (see https://github.com/quarto-dev/quarto-cli/issues/6936)
        -- or empty identifier (see https://github.com/quarto-dev/quarto-cli/issues/6867)
        if #div.classes == 0 and #div.attributes == 0 and div.identifier == "" then
          return div.content
        end
      end
    })
  end
  
  table.insert(filters, {
    Inlines = function(inlines)
      local current_node = nil
      for i = 1, #inlines do
        if inlines[i].t ~= "RawInline" then
          current_node = nil
        else
          if current_node and inlines[i].format == current_node.format then
            current_node.text = current_node.text .. inlines[i].text
            inlines[i].text = ""
          else
            current_node = inlines[i]
          end
        end
      end
      return inlines
    end,
    Blocks = function(blocks)
      local current_node = nil
      for i = 1, #blocks do
        if blocks[i].t ~= "RawBlock" or not blocks[i].format:match(".*-merge$") then
          current_node = nil
        else
          blocks[i].format = blocks[i].format:gsub("-merge$", "")
          if current_node and blocks[i].format == current_node.format then
            current_node.text = current_node.text .. blocks[i].text
            blocks[i].text = ""
          else
            current_node = blocks[i]
          end
        end
      end
      return blocks
    end
  })
  return filters
end