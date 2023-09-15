-- quarto-pre.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- required version
PANDOC_VERSION:must_be_at_least '2.13'

-- [import]
function import(script)
  local path = PANDOC_SCRIPT_FILE:match("(.*[/\\])")
  dofile(path .. script)
end

import("../mainstateinit.lua")
import("../common/colors.lua")
import("../common/error.lua")
import("../common/base64.lua")
import("../common/latex.lua")
import("../common/meta.lua")
import("../common/options.lua")
import("../common/table.lua")
import("../common/pandoc.lua")
import("../common/filemetadata.lua")
import("../common/layout.lua")
import("../common/refs.lua")
import("../common/figures.lua")
import("../common/tables.lua")
import("../common/theorems.lua")
import("../common/debug.lua")
import("../common/format.lua")
import("../common/string.lua")
import("../common/list.lua")
import("../common/lunacolors.lua")
import("../common/log.lua")
import("../common/url.lua")
import("../common/paths.lua")
import("results.lua")
import("options.lua")
import("code-filename.lua")
import("shortcodes-handlers.lua")
import("outputs.lua")
import("figures.lua")
import("table-rawhtml.lua")
import("table-captions.lua")
import("table-colwidth.lua")
import("theorems.lua")
import("resourcefiles.lua")
import("bibliography-formats.lua")
import("book-numbering.lua")
import("book-links.lua")
import("meta.lua")
import("code.lua")
import("engine-escape.lua")
import("panel-sidebar.lua")
import("panel-input.lua")
import("panel-layout.lua")
import("hidden.lua")
import("line-numbers.lua")
import("output-location.lua")
import("include-paths.lua")
import("input-traits.lua")
import("project-paths.lua")

import("../customnodes/shortcodes.lua")
import("../customnodes/content-hidden.lua")
import("../customnodes/callout.lua")
import("../customnodes/decoratedcodeblock.lua")
import("../customnodes/panel-tabset.lua")

-- [/import]

initShortcodeHandlers()

local filterList = {

  { name = "flags", filter = compute_flags() },

  -- https://github.com/quarto-dev/quarto-cli/issues/5031
  -- recompute options object in case user filters have changed meta
  -- this will need to change in the future; users will have to indicate
  -- when they mutate options
  { name = "pre-read-options-again", filter = init_options() },

  { name = "pre-parse-pandoc3-figures", 
    filter = parse_pandoc3_figures(), 
    flags = { "has_pandoc3_figure" } 
  },

  { name = "pre-bibliography-formats", filter = bibliography_formats() }, 
  
  { name = "pre-shortcodes-filter", 
    filter = shortcodes_filter(),
    flags = { "has_shortcodes" } },

  { name = "pre-hidden", 
    filter = hidden(), 
    flags = { "has_hidden" } },

  { name = "pre-content-hidden", 
    filter = content_hidden(),
    flags = { "has_conditional_content" } },

  { name = "pre-table-captions", 
    filter = table_captions(),
    flags = { "has_table_captions" } },

  { name = "pre-longtable-no-caption-fixup", 
    filter = longtable_no_caption_fixup(),
    flags = { "has_longtable_no_caption_fixup" } },
  
  { name = "pre-code-annotations", 
    filter = code_annotations(),
    flags = { "has_code_annotations" } },
  
  { name = "pre-code-annotations-meta", filter = code_meta() },

  { name = "pre-unroll-cell-outputs", 
    filter = unroll_cell_outputs(),
    flags = { "needs_output_unrolling" } },

  { name = "pre-output-location", 
    filter = output_location()
  },

  { name = "pre-combined-figures-theorems-etc", filter = combineFilters({
    file_metadata(),
    index_book_file_targets(),
    book_numbering(),
    include_paths(),
    resource_files(),
    quarto_pre_figures(),
    quarto_pre_theorems(),
    docx_callout_and_table_fixup(),
    -- code_filename(),
    line_numbers(),
    engine_escape(),
    bootstrap_panel_input(),
    bootstrap_panel_layout(),
    bootstrap_panel_sidebar(),
    table_respecify_gt_css(),
    table_colwidth(), 
    table_classes(),
    input_traits(),
    resolve_book_file_targets(),
    project_paths()
  }) },

  { name = "pre-quarto-pre-meta-inject", filter = quarto_pre_meta_inject() },
  { name = "pre-write-results", filter = write_results() },
}

return filterList
