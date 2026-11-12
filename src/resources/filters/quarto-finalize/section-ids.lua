-- section-ids.lua
--
-- Pandoc >= 3.10.1 merges a Div with an id that starts with a heading into
-- the heading's section and gives the section the Div's id
-- (jgm/pandoc#11745). Swapping the two ids keeps the heading id, which is
-- the crossref target, on the section.
--
-- Only formats where the merge changes ids are swapped: LaTeX, Typst and
-- docx write both ids, so a swap there would move the label off the
-- heading. The condition mirrors makeSections (Div nesting only, sections
-- split by later headings). The revealjs/beamer/docbook/context/asciidoc
-- group works around jgm/pandoc#12070 (writers dropping the heading id)
-- and Quarto's revealjs heading-attribute stripping; beamer, docbook,
-- context and asciidoc can leave it once a fixed Pandoc is bundled
-- (re-check their output first).
--
-- Copyright (C) 2026 Posit Software, PBC

function section_ids()
  -- "swap_section": also swap Divs with class `section`
  local function format_group()
    local format = _quarto.format
    if format.isRevealJsOutput() or format.isBeamerOutput()
        or FORMAT:match("^docbook") or FORMAT == "context"
        or format.isAsciiDocOutput() then
      return "swap_section"
    elseif format.isHtmlOutput() then
      return "skip_section"
    end
    return nil
  end

  -- pandoc's headerLtEq: a Header of level <= `level`, or a Div whose
  -- first block is one (recursively)
  local function lt_eq(block, level)
    if block.t == "Header" then
      return block.level <= level
    elseif block.t == "Div" and block.content[1] then
      return lt_eq(block.content[1], level)
    end
    return false
  end

  local function should_swap(div, group)
    local header = div.content[1]
    if div.identifier == "" or not header or header.t ~= "Header"
        or header.identifier == "" or header.identifier == div.identifier then
      return false
    end
    for i = 2, #div.content do
      if lt_eq(div.content[i], header.level) then
        return false
      end
    end
    if div.classes:includes("section") then
      return group == "swap_section"
    end
    for _, class in ipairs({ "column", "columns", "fragment", "cell" }) do
      if div.classes:includes(class) then
        return false
      end
    end
    return true
  end

  return {
    Pandoc = function(doc)
      local group = format_group()
      if group == nil then
        return nil
      end
      local changed = false
      local function walk(blocks)
        for _, block in ipairs(blocks) do
          if block.t == "Div" then
            if should_swap(block, group) then
              local header = block.content[1]
              block.identifier, header.identifier = header.identifier, block.identifier
              changed = true
            end
            walk(block.content)
          end
        end
      end
      walk(doc.blocks)
      if changed then
        return doc
      end
    end
  }
end
