-- flags.lua
-- Copyright (C) 2020-2023 Posit Software, PBC

-- computes performance flags in one pass
-- so that we can skip as many filters as possible
-- when we don't need them

local patterns = require("modules/patterns")
local constants = require("modules/constants")
local lightbox_module = require("modules/lightbox")

flags = {}

function compute_flags()
  local table_pattern = patterns.html_table
  local table_tag_pattern = patterns.html_table_tag_name
  local gt_table_pattern = patterns.html_gt_table
  local function find_shortcode_in_attributes(el)
    for k, v in pairs(el.attributes) do
      if type(v) == "string" and v:find("%{%{%<") then
        return true
      end
    end
    return false
  end

  return {{
    Header = function(el)
      if find_shortcode_in_attributes(el) then
        flags.has_shortcodes = true
      end
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
        local long_table_match, _ = _quarto.modules.patterns.match_in_list_of_patterns(el.text, _quarto.patterns.latexLongtableEnvPatterns)
        if long_table_match then
            local caption_match, _= _quarto.modules.patterns.match_in_list_of_patterns(el.text, _quarto.patterns.latexCaptionPatterns)
            if not caption_match then
              flags.has_longtable_no_caption_fixup = true
            end
        end
      end

      if el.text:find("%{%{%<") then
        flags.has_shortcodes = true
      end
    end,
    Div = function(node)
      if find_shortcode_in_attributes(node) then
        flags.has_shortcodes = true
      end
      local type = refType(node.attr.identifier)
      if theorem_types[type] ~= nil or proof_type(node) ~= nil then
        flags.has_theorem_refs = true
      end

      local has_lightbox = lightbox_module.el_has_lightbox(node)
      if has_lightbox then
        flags.has_lightbox = true
      end

      if node.attr.classes:find("landscape") then
        flags.has_landscape = true
      end

      if node.attr.classes:find("hidden") then
        flags.has_hidden = true
      end

      if node.attr.classes:find("cell") then
        -- cellcleanup.lua
        flags.has_output_cells = true

        -- FIXME: are we actually triggering this with FloatRefTargets?
        -- table captions
        local kTblCap = "tbl-cap"
        if hasTableRef(node) or node.attr.attributes[kTblCap] then
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
      if el.format == "quarto-internal" then
        local result, data = pcall(function() 
          local data = quarto.json.decode(el.text)
          return data.type
        end)
        if result == false then
          warn("[Malformed document] Failed to decode quarto-internal JSON: " .. el.text)
          return
        end
        if data == "contents-shortcode" then
          flags.has_contents_shortcode = true
        end
      elseif el.text:find("%{%{%<") then
        flags.has_shortcodes = true
      end
    end,
    Image = function(node)
      if find_shortcode_in_attributes(node) or node.src:find("%{%{%<") then
        flags.has_shortcodes = true
      end

      local has_lightbox = lightbox_module.el_has_lightbox(node)
      if has_lightbox then
        flags.has_lightbox = true
      end
    end,
    Shortcode = function(node)
      flags.has_shortcodes = true
    end,
    Link = function(node)
      if find_shortcode_in_attributes(node) then
        flags.has_shortcodes = true
      end
      if node.target:find("%{%{%<") then
        flags.has_shortcodes = true
      end
    end,
    Span = function(node)
      if find_shortcode_in_attributes(node) then
        flags.has_shortcodes = true
      end
      if node.attr.classes:find("content-hidden") or node.attr.classes:find("content-visible") then
        flags.has_conditional_content = true
      end
    end,
    Figure = function(node)
      flags.has_pandoc3_figure = true
    end,
    Note = function(node)
      flags.has_notes = true
    end,
  }, {
    Meta = function(el)
      local lightbox_auto = lightbox_module.automatic(el)
      if lightbox_auto then
        flags.has_lightbox = true
      elseif lightbox_auto == false then
        flags.has_lightbox = false
      end
    end,
  }}
end
