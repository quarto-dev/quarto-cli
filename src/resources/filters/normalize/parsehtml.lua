-- parsehtml.lua
-- Copyright (C) 2020-2023 Posit Software, PBC

local patterns = require("modules/patterns")
local constants = require("modules/constants")

local function preprocess_table_text(src)
  -- html manipulation with regex is fraught, but those specific
  -- changes are safe assuming that no one is using quarto- as
  -- a prefix for dataset attributes in the tables.
  -- See
  -- * https://www.w3.org/html/wg/spec/syntax.html#start-tags
  -- * https://www.w3.org/html/wg/spec/syntax.html#end-tags

  src = src:gsub("<th([%s>])", "<td data-quarto-table-cell-role=\"th\"%1")
  src = src:gsub("</th([%s>])", "</td%1")
  src = src:gsub("<table([%s>])", "<table data-quarto-postprocess=\"true\"%1")

  return src
end

function parse_html_tables()
  local filter
  if param(constants.kHtmlTableProcessing) == "none" then
    return {}
  end
  filter = {
    traverse = "topdown",
    Div = function(div)
      if div.attributes[constants.kHtmlTableProcessing] then
        -- catch and remove attributes
        local htmlTableProcessing = div.attributes[constants.kHtmlTableProcessing]
        div.attributes[constants.kHtmlTableProcessing] = nil
        if htmlTableProcessing == "none" then
          quarto.log.output(div.attr == pandoc.Attr())
          if div.attr == pandoc.Attr() then
            -- if no other attributes are set on the div, don't keep it
            return div.content, false
          else
            -- when set on a div like div.cell-output-display, we need to keep it
            return div, false
          end
        end
      end
    end,
    RawBlock = function(el)
      if _quarto.format.isRawHtml(el) then
        -- if we have a raw html table in a format that doesn't handle raw_html
        -- then have pandoc parse the table into a proper AST table block
        local pat = patterns.html_table
        local i, j = string.find(el.text, pat)
        if i == nil then
          return nil
        end

        -- we're already at a state of sin here, cf https://stackoverflow.com/a/1732454
        -- but this is important enough to do a little more work anyway
        -- 
        -- specifically, we should do our best not to break good HTML when it's there



        local tableBegin,tableBody,tableEnd = el.text:match(pat)
        if tableBegin then
          local before_table = string.sub(el.text, 1, i - 1)
          local after_table = string.sub(el.text, j + 1)
          local tableHtml = tableBegin .. "\n" .. tableBody .. "\n" .. tableEnd
          -- Pandoc's HTML-table -> AST-table processing does not faithfully respect
          -- `th` vs `td` elements. This causes some complex tables to be parsed incorrectly,
          -- and changes which elements are `th` and which are `td`.
          --
          -- For quarto, this change is not acceptable because `td` and `th` have
          -- accessibility impacts (see https://github.com/rstudio/gt/issues/678 for a concrete
          -- request from a screen-reader user).
          --
          -- To preserve td and th, we replace `th` elements in the input with 
          -- `td data-quarto-table-cell-role="th"`. 
          -- 
          -- Then, in our HTML postprocessor,
          -- we replace th elements with td (since pandoc chooses to set some of its table
          -- elements as th, even if the original table requested not to), and replace those 
          -- annotated td elements with th elements.

          tableHtml = preprocess_table_text(tableHtml)
          -- process html with raw_html so that contents that are not parseable
          -- by Pandoc end up as rawblock elements
          local tableDoc = pandoc.read(tableHtml, "html+raw_html")
          local skip = false
          local found = false
          _quarto.ast.walk(tableDoc, {
            Table = function(table)
              found = true
              if table.attributes[constants.kDisableProcessing] == "true" then
                skip = true
              end
            end,
          })
          if not found then
            warn("Unable to parse table from raw html block: skipping.")
            return nil
          end
          if skip then
            return nil
          end
          flags.has_tables = true
          local blocks = pandoc.Blocks({})
          if before_table ~= "" then
            -- this clause is presently redundant, but if we ever
            -- parse more than one type of element, then we'll
            -- need it. We keep it here for symmetry with
            -- the after_table clause.
            local block = pandoc.RawBlock(el.format, before_table)
            local result = _quarto.ast.walk(block, filter)
            if type(result) == "table" then
              blocks:extend(result)
            else
              blocks:insert(result)
            end
          end
          blocks:extend(tableDoc.blocks)
          if after_table ~= "" then
            local block = pandoc.RawBlock(el.format, after_table)
            local result = _quarto.ast.walk(block, filter)
            if type(result) == "table" then
              blocks:extend(result)
            else
              blocks:insert(result)
            end
          end
          return blocks
        end
      end
      return el
    end
  }
  return filter
end