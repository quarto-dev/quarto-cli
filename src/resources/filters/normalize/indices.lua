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
  local table_tag_pattern = htmlTableTagNamePattern()
  local gt_table_pattern = htmlGtTablePattern()

  return {
    Table = function(node)
      indices.has_tables = true
    end,
    RawBlock = function(el)
      if el.format == "html" then
        local i, j = string.find(el.text, table_pattern)
        if i ~= nil then
          indices.has_raw_html_tables = true
        end
        i, j = string.find(el.text, table_tag_pattern)
        if i ~= nil then
          indices.has_partial_raw_html_tables = true
        end
        i, j = string.find(el.text, gt_table_pattern)
        if i ~= nil then
          indices.has_gt_tables = true
        end
      end

      if _quarto.format.isRawLatex(el) then
        if (el.text:match(_quarto.patterns.latexLongtablePattern) and
            not el.text:match(latexCaptionPattern)) then
            indices.has_longtable_no_caption_fixup = true
        end
      end

      if el.text:find("%{%{%<") then
        indices.has_shortcodes = true
      end
    end,
    Div = function(node)
      needs_dom_processing(node)
      if node.attr.classes:find("hidden") then
        indices.has_hidden = true
      end


      if node.attr.classes:find("cell") then
        -- cellcleanup.lua
        if (#node.classes == 1 and 
          #node.content == 0) then
          indices.has_empty_cells = true
        end

        -- tbl_colwidths
        local tblColwidths = node.attr.attributes[kTblColwidths]
        if tblColwidths ~= nil then
          indices.has_tbl_colwidths = true
        end

        -- table captions
        local tblCap = extractTblCapAttrib(node,kTblCap)
        if hasTableRef(node) or tblCap then
          indices.has_table_captions = true
        end

        -- outputs.lua
        if not param("output-divs", true) then
          if not (_quarto.format.isPowerPointOutput() and hasLayoutAttributes(node)) then
            indices.needs_output_unrolling = true
          end
        end
      end
    end,
    CodeBlock = function(node)
      if node.attr.classes:find("hidden") then
        indices.has_hidden = true
      end
      if node.attr.classes:find("content-hidden") or node.attr.classes:find("content-visible") then
        indices.has_conditional_content = true
      end
      if node.text:match('%s*<([0-9]+)>%s*') then
        indices.has_code_annotations = true
      end
      if node.text:find("%{%{%<") then
        indices.has_shortcodes = true
      end
    end,
    Code = function(node)
      if node.text:find("%{%{%<") then
        indices.has_shortcodes = true
      end
    end,
    RawInline = function(el)
      if el.text:find("%{%{%<") then
        indices.has_shortcodes = true
      end

      if el.format == "QUARTO_custom" and el.text:find("Shortcode") then
        indices.has_shortcodes = true
      end
    end,
    Image = function(node)
      if node.src:find("%{%{%<") then
        indices.has_shortcodes = true
      end
    end,
    Link = function(node)
      if node.target:find("%{%{%<") then
        indices.has_shortcodes = true
      end
    end,
    Span = function(node)
      needs_dom_processing(node)
      if node.attr.classes:find("content-hidden") or node.attr.classes:find("content-visible") then
        indices.has_conditional_content = true
      end
    end,
    Figure = function(node)
      indices.has_pandoc3_figure = true
    end
  }
end