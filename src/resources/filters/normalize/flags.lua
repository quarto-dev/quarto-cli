-- flags.lua
-- Copyright (C) 2020-2023 Posit Software, PBC

-- computes performance flags in one pass
-- so that we can skip as many filters as possible
-- when we don't need them

local patterns = require("modules/patterns")
local constants = require("modules/constants")
local lightbox = require("modules/lightbox")

flags = {}

function compute_flags()
  local table_pattern = patterns.html_table
  local table_tag_pattern = patterns.html_table_tag_name
  local gt_table_pattern = patterns.html_gt_table
  local html_table_caption_pattern = patterns.html_table_caption
  local latex_caption_pattern = "(\\caption{)(.*)" .. refLabelPattern("tbl") .. "([^}]*})"

  return {
    Meta = function(el)
      local lightbox_auto = lightbox.automatic(el)
      if lightbox_auto then
        flags.has_lightbox = true
      elseif lightbox_auto == false then
        flags.has_lightbox = false
      end
    end,
    Header = function(el)
      crossref.maxHeading = math.min(crossref.maxHeading, el.level)
    end,

    Table = function(node)
      flags.has_tables = true
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
        
    end,
    Div = function(node)
      local type = refType(node.attr.identifier)
      if theoremTypes[type] ~= nil or proofType(node) ~= nil then
        flags.has_theorem_refs = true
      end

      local has_lightbox = lightbox.el_has_lightbox(node)
      if has_lightbox then
        flags.has_lightbox = true
      end

      if node.attr.classes:find("hidden") then
        flags.has_hidden = true
      end

      if node.attr.classes:find("cell") then
        -- cellcleanup.lua
        flags.has_output_cells = true

        -- FIXME: are we actually triggering this with FloatRefTargets?
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
    end,
    Image = function(node)
      if node.src:find("%{%{%<") then
        flags.has_shortcodes = true
      end

      local has_lightbox = lightbox.el_has_lightbox(node)
      if has_lightbox then
        flags.has_lightbox = true
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
      if node.attr.classes:find("content-hidden") or node.attr.classes:find("content-visible") then
        flags.has_conditional_content = true
      end
    end,
    Figure = function(node)
      flags.has_pandoc3_figure = true
    end
  }
end