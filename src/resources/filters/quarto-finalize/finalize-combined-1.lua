-- finalize_combined_1.lua
--
-- An optimized implementation of the following filters in a single pass:
--   - coalesce_raw
--   - descaffold
--
-- Copyright (C) 2025 Posit Software, PBC
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

function finalize_combined_1()
  local changed = false

  return {
    Plain = function(plain) -- descaffold
      if #plain.content == 0 then
        return {}
      end
    end,
    Span = function(el) -- descaffold
      if el.classes:includes("quarto-scaffold") then
        return el.content
      end
    end,
    Div = function(el) 
      if (quarto.doc.isFormat("latex") and #el.classes == 0 and #el.attributes == 0 and el.identifier == "") or -- coalesce_raw
        el.classes:includes("quarto-scaffold") then -- descaffold
        return el.content
      end
    end,
    Inlines = function(inlines) -- coalesce_raw
      local current_node = nil
      for i = 1, #inlines do
        if inlines[i].t ~= "RawInline" then
          current_node = nil
        else
          if current_node and inlines[i].format == current_node.format then
            changed = true
            current_node.text = current_node.text .. inlines[i].text
            inlines[i].text = ""
          else
            current_node = inlines[i]
          end
        end
      end
      return inlines
    end,
    Blocks = function(blocks) -- coalesce_raw
      local current_node = nil
      for i = 1, #blocks do
        if blocks[i].t ~= "RawBlock" or not blocks[i].format:match(".*-merge$") then
          current_node = nil
        else
          blocks[i].format = blocks[i].format:gsub("-merge$", "")
          if current_node and blocks[i].format == current_node.format then
            changed = true
            current_node.text = current_node.text .. blocks[i].text
            blocks[i].text = ""
          else
            current_node = blocks[i]
          end
        end
      end
      return blocks
    end
  }
end

function make_scaffold(ctor, node)
  return ctor(node or {}, pandoc.Attr("", {"quarto-scaffold", "hidden"}, {}))
end