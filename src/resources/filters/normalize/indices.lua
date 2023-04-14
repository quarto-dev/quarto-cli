-- indices.lua
-- Copyright (C) 2020-2023 Posit Software, PBC

-- computes performance indices in one pass
-- so that we can skip as many filters as possible
-- when we don't need them

indices = {}

function needs_dom_processing(node)
  if node.attributes.qmd ~= nil or node.attributes["qmd-base64"] ~= nil then
    indices.needs_dom_processing = true
  end
end

function compute_indices()
  local table_pattern = htmlTablePattern()

  return {
    RawBlock = function(el)
      if el.format == "html" then
        local pat = htmlTablePattern()
        local i, j = string.find(el.text, pat)
        if i ~= nil then
          indices.has_raw_html_tables = true
        end
      end
    end,
    Div = function(node)
      needs_dom_processing(node)
    end,
    Span = function(node)
      needs_dom_processing(node)
    end,
    Figure = function(node)
      indices.has_pandoc3_figure = true
    end
  }
end