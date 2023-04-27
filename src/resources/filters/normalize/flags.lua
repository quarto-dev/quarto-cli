-- flags.lua
-- Copyright (C) 2020-2023 Posit Software, PBC

-- computes performance flags in one pass
-- so that we can skip as many filters as possible
-- when we don't need them

flags = {}

function needs_dom_processing(node)
  if node.attributes.qmd ~= nil or node.attributes["qmd-base64"] ~= nil then
    flags.needs_dom_processing = true
  end
end

function compute_flags()
  local table_pattern = htmlTablePattern()
  local table_tag_pattern = htmlTableTagNamePattern()
  local gt_table_pattern = htmlGtTablePattern()
  local html_table_caption_pattern = htmlTableCaptionPattern()
  local latex_caption_pattern = "(\\caption{)(.*)" .. refLabelPattern("tbl") .. "([^}]*})"

  return {
    Header = function(el)
      crossref.maxHeading = math.min(crossref.maxHeading, el.level)
    end,

    Table = function(node)
      flags.has_tables = true
      if node.caption.long ~= nil then
        flags.has_table_with_long_captions = true
      end
    end,

    Cite = function(cite)
      flags.has_cites = true
    end,

    RawBlock = function(el)
      if el.format == "html" then
        local i, j = string.find(el.text, table_pattern)
        if i ~= nil then
          flags.has_raw_html_tables = true
        end
        i, j = string.find(el.text, table_tag_pattern)
        if i ~= nil then
          flags.has_partial_raw_html_tables = true
        end
        i, j = string.find(el.text, gt_table_pattern)
        if i ~= nil then
          flags.has_gt_tables = true
        end
      end

      if _quarto.format.isRawLatex(el) then
        if (el.text:match(_quarto.patterns.latexLongtablePattern) and
            not el.text:match(_quarto.patterns.latexCaptionPattern)) then
            flags.has_longtable_no_caption_fixup = true
        end
      end

      if el.text:find("%{%{%<") then
        flags.has_shortcodes = true
      end

      -- crossref/preprocess.lua
      if _quarto.format.isRawHtml(el) and _quarto.format.isHtmlOutput() then
        local _, caption, _ = string.match(el.text, html_table_caption_pattern)
        if caption ~= nil then
          flags.has_html_table_captions = true
        end
      end

      if _quarto.format.isRawLatex(el) and _quarto.format.isLatexOutput() then      
        -- try to find a caption with an id
        local _, _, label, _ = el.text:match(latex_caption_pattern)
        if label ~= nil then
          flags.has_latex_table_captions = true
        end
      end
        
    end,
    Div = function(node)

      if isFigureDiv(node) then
        flags.has_figure_divs = true
      end
      
      if hasLayoutAttributes(node) then
        flags.has_layout_attributes = true
      end

      local type = refType(node.attr.identifier)
      if theoremTypes[type] ~= nil or proofType(node) ~= nil then
        flags.has_theorem_refs = true
      end

      needs_dom_processing(node)
      if node.attr.classes:find("hidden") then
        flags.has_hidden = true
      end

      -- crossref/preprocess.lua
      if hasFigureOrTableRef(node) then
        flags.has_figure_or_table_ref = true
      end

      if node.attr.classes:find("cell") then
        -- cellcleanup.lua
        flags.has_output_cells = true

        -- tbl_colwidths
        local tblColwidths = node.attr.attributes[kTblColwidths]
        if tblColwidths ~= nil then
          flags.has_tbl_colwidths = true
        end

        -- table captions
        local tblCap = extractTblCapAttrib(node,kTblCap)
        if hasTableRef(node) or tblCap then
          flags.has_table_captions = true
        end

        -- outputs.lua
        if not param("output-divs", true) then
          if not (_quarto.format.isPowerPointOutput() and hasLayoutAttributes(node)) then
            flags.needs_output_unrolling = true
          end
        end
      end
    end,
    Para = function(node)
      if discoverFigure(node, false) then
        flags.has_discoverable_figures = true
      end
    end,
    CodeBlock = function(node)
      if node.attr.classes:find("hidden") then
        flags.has_hidden = true
      end
      if node.attr.classes:find("content-hidden") or node.attr.classes:find("content-visible") then
        flags.has_conditional_content = true
      end
      if node.text:match('%s*<([0-9]+)>%s*') then
        flags.has_code_annotations = true
      end
      if node.text:find("%{%{%<") then
        flags.has_shortcodes = true
      end
    end,
    Code = function(node)
      if node.text:find("%{%{%<") then
        flags.has_shortcodes = true
      end
    end,
    RawInline = function(el)
      if el.text:find("%{%{%<") then
        flags.has_shortcodes = true
      end

      if el.format == "QUARTO_custom" and el.text:find("Shortcode") then
        flags.has_shortcodes = true
      end
    end,
    Image = function(node)
      if node.src:find("%{%{%<") then
        flags.has_shortcodes = true
      end
    end,
    Shortcode = function(node)
      flags.has_shortcodes = true
    end,
    Link = function(node)
      if node.target:find("%{%{%<") then
        flags.has_shortcodes = true
      end
    end,
    Span = function(node)
      needs_dom_processing(node)
      if node.attr.classes:find("content-hidden") or node.attr.classes:find("content-visible") then
        flags.has_conditional_content = true
      end
    end,
    Figure = function(node)
      flags.has_pandoc3_figure = true
    end
  }
end