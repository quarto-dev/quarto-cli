-- crossref.lua
-- Copyright (C) 2020-2023 Posit Software, PBC

-- this is the standalone version of our crossref filters, used in the IDEs for auto-completion

-- required version
PANDOC_VERSION:must_be_at_least '2.13'

-- [import]
function import(script)
  local path = PANDOC_SCRIPT_FILE:match("(.*[/\\])")
  dofile(path .. script)
end

import("../mainstateinit.lua")

import("../ast/customnodes.lua")
import("../ast/emulatedfilter.lua")
import("../ast/parse.lua")
import("../ast/render.lua")
import("../ast/runemulation.lua")
import("../ast/traceexecution.lua")
import("../ast/wrappedwriter.lua")

import("../common/base64.lua")
import("../common/citations.lua")
import("../common/colors.lua")
import("../common/collate.lua")
import("../common/debug.lua")
import("../common/error.lua")
import("../common/figures.lua")
import("../common/filemetadata.lua")
import("../common/floats.lua")
import("../common/format.lua")
import("../common/latex.lua")
import("../common/layout.lua")
import("../common/list.lua")
import("../common/log.lua")
import("../common/lunacolors.lua")
import("../common/maporcall.lua")
import("../common/meta.lua")
import("../common/options.lua")
import("../common/pandoc.lua")
import("../common/paths.lua")
import("../common/refs.lua")
import("../common/string.lua")
import("../common/table.lua")
import("../common/tables.lua")
import("../common/theorems.lua")
import("../common/url.lua")
import("../common/validate.lua")
import("../common/wrapped-filter.lua")

import("../quarto-init/configurefilters.lua")
import("../quarto-init/includes.lua")
import("../quarto-init/resourcerefs.lua")

import("../normalize/flags.lua")
import("../normalize/normalize.lua")
import("../normalize/parsehtml.lua")
import("../normalize/extractquartodom.lua")
import("../normalize/astpipeline.lua")
import("../normalize/capturereaderstate.lua")
import("../normalize/fixupdatauri.lua")

import("../crossref/custom.lua")
import("../crossref/index.lua")
import("../crossref/preprocess.lua")
import("../crossref/sections.lua")
import("../crossref/figures.lua")
import("../crossref/tables.lua")
import("../crossref/equations.lua")
import("../crossref/theorems.lua")
import("../crossref/qmd.lua")
import("../crossref/refs.lua")
import("../crossref/meta.lua")
import("../crossref/format.lua")
import("../crossref/options.lua")

import("../quarto-pre/bibliography-formats.lua")
import("../quarto-pre/book-links.lua")
import("../quarto-pre/book-numbering.lua")
import("../quarto-pre/code-annotation.lua")
import("../quarto-pre/code-filename.lua")
import("../quarto-pre/engine-escape.lua")
import("../quarto-pre/figures.lua")
import("../quarto-pre/hidden.lua")
import("../quarto-pre/include-paths.lua")
import("../quarto-pre/input-traits.lua")
import("../quarto-pre/line-numbers.lua")
import("../quarto-pre/meta.lua")
import("../quarto-pre/options.lua")
import("../quarto-pre/output-location.lua")
import("../quarto-pre/outputs.lua")
import("../quarto-pre/panel-input.lua")
import("../quarto-pre/panel-layout.lua")
import("../quarto-pre/panel-sidebar.lua")
import("../quarto-pre/parsefiguredivs.lua")
import("../quarto-pre/project-paths.lua")
import("../quarto-pre/resourcefiles.lua")
import("../quarto-pre/results.lua")
import("../quarto-pre/shiny.lua")
import("../quarto-pre/shortcodes-handlers.lua")
import("../quarto-pre/table-classes.lua")
import("../quarto-pre/table-captions.lua")
import("../quarto-pre/table-colwidth.lua")
import("../quarto-pre/table-rawhtml.lua")
import("../quarto-pre/theorems.lua")

import("../customnodes/latexenv.lua")
import("../customnodes/latexcmd.lua")
import("../customnodes/htmltag.lua")
import("../customnodes/shortcodes.lua")
import("../customnodes/content-hidden.lua")
import("../customnodes/decoratedcodeblock.lua")
import("../customnodes/callout.lua")
import("../customnodes/panel-tabset.lua")
import("../customnodes/floatreftarget.lua")
import("../customnodes/theorem.lua")
import("../customnodes/panellayout.lua")

import("../quarto-init/metainit.lua")

-- [/import]

initCrossrefIndex()

initShortcodeHandlers()

local quarto_init_filters = {
  { name = "init-quarto-meta-init", filter = quarto_meta_init() },
  { name = "init-quarto-custom-meta-init", filter = {
    Meta = function(meta)
      content_hidden_meta(meta)
    end
  }},
}

-- v1.4 change: quartoNormalize is responsible for producing a
-- "normalized" document that is ready for quarto-pre, etc.
-- notably, user filters will run on the normalized document and
-- see a "Quarto AST". For example, Figure nodes are no longer
-- going to be present, and will instead be represented by
-- our custom AST infrastructure (FloatRefTarget specifically).

local quarto_normalize_filters = {
  { name = "normalize", filter = filterIf(function()
    if quarto_global_state.active_filters == nil then
      return false
    end
    return quarto_global_state.active_filters.normalization
  end, normalize_filter()) },

  { name = "pre-table-merge-raw-html", 
    filter = table_merge_raw_html()
  },

  -- { name = "pre-content-hidden-meta",
  --   filter = content_hidden_meta() },

  -- 2023-04-11: We want to combine combine-1 and combine-2, but parse_md_in_html_rawblocks
  -- can't be combined with parse_html_tables. combineFilters
  -- doesn't inspect the contents of the results in the inner loop in case
  -- the result is "spread" into a Blocks or Inlines.
  
  { name = "normalize-combined-1", filter = combineFilters({
      parse_html_tables(),
      parse_extended_nodes(),
      code_filename(),
    })
  },
  { 
    name = "normalize-combine-2", 
    filter = combineFilters({
      parse_md_in_html_rawblocks(),
      parse_reftargets(),
    }),
  },
}

local quarto_pre_filters = {
  -- quarto-pre

  { name = "flags", filter = compute_flags() },

  { name = "pre-shortcodes-filter", 
    filter = shortcodes_filter(),
    flags = { "has_shortcodes" } },
}

local quarto_crossref_filters = {

  { name = "crossref-preprocess-floats", filter = crossref_mark_subfloats(),
  },

  { name = "crossref-preprocessTheorems", 
    filter = crossref_preprocess_theorems(),
    flags = { "has_theorem_refs" } },

  { name = "crossref-combineFilters", filter = combineFilters({
    file_metadata(),
    qmd(),
    sections(),
    crossref_figures(),
    equations(),
    crossref_theorems(),
  })},

  { name = "crossref-resolveRefs", filter = resolveRefs(),
    flags = { "has_cites" } },
    
  { name = "crossref-crossrefMetaInject", filter = crossrefMetaInject() },
  { name = "crossref-writeIndex", filter = writeIndex() },
}

local filterList = {}

tappend(filterList, quarto_init_filters)
tappend(filterList, quarto_normalize_filters)
tappend(filterList, quarto_pre_filters)
tappend(filterList, quarto_crossref_filters)

local result = run_as_extended_ast({
  pre = {
    init_options()
  },
  afterFilterPass = function() 
    -- After filter pass is called after each pass through a filter group
    -- allowing state or other items to be handled
    resetFileMetadata()
  end,
  filters = filterList,
})

return result