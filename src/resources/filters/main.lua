-- main.lua
-- Copyright (C) 2020-2023 Posit Software, PBC

-- required version
PANDOC_VERSION:must_be_at_least '2.13'

-- [import]
function import(script)
  local path = PANDOC_SCRIPT_FILE:match("(.*[/\\])")
  dofile(path .. script)
end

import("./mainstateinit.lua")

import("./ast/customnodes.lua")
import("./ast/emulatedfilter.lua")
import("./ast/parse.lua")
import("./ast/render.lua")
import("./ast/runemulation.lua")
import("./ast/traceexecution.lua")
import("./ast/wrappedwriter.lua")

import("./common/base64.lua")
import("./common/citations.lua")
import("./common/colors.lua")
import("./common/debug.lua")
import("./common/error.lua")
import("./common/figures.lua")
import("./common/filemetadata.lua")
import("./common/format.lua")
import("./common/latex.lua")
import("./common/layout.lua")
import("./common/list.lua")
import("./common/log.lua")
import("./common/lunacolors.lua")
import("./common/maporcall.lua")
import("./common/meta.lua")
import("./common/options.lua")
import("./common/pandoc.lua")
import("./common/paths.lua")
import("./common/refs.lua")
import("./common/string.lua")
import("./common/table.lua")
import("./common/tables.lua")
import("./common/theorems.lua")
import("./common/url.lua")
import("./common/validate.lua")
import("./common/wrapped-filter.lua")

import("./quarto-init/configurefilters.lua")
import("./quarto-init/includes.lua")
import("./quarto-init/resourcerefs.lua")

import("./quarto-post/render-asciidoc.lua")
import("./quarto-post/book.lua")
import("./quarto-post/cites.lua")
import("./quarto-post/delink.lua")
import("./quarto-post/docx.lua")
import("./quarto-post/fig-cleanup.lua")
import("./quarto-post/foldcode.lua")
import("./quarto-post/ipynb.lua")
import("./quarto-post/latex.lua")
import("./quarto-post/latexdiv.lua")
import("./quarto-post/meta.lua")
import("./quarto-post/ojs.lua")
import("./quarto-post/jats.lua")
import("./quarto-post/responsive.lua")
import("./quarto-post/reveal.lua")
import("./quarto-post/tikz.lua")
import("./quarto-post/pdf-images.lua")
import("./quarto-post/cellcleanup.lua")
import("./quarto-post/bibliography.lua")

import("./quarto-finalize/dependencies.lua")
import("./quarto-finalize/book-cleanup.lua")
import("./quarto-finalize/mediabag.lua")
import("./quarto-finalize/meta-cleanup.lua")

import("./normalize/flags.lua")
import("./normalize/normalize.lua")
import("./normalize/parsehtml.lua")
import("./normalize/pandoc3.lua")
import("./normalize/extractquartodom.lua")

import("./layout/asciidoc.lua")
import("./layout/meta.lua")
import("./layout/width.lua")
import("./layout/latex.lua")
import("./layout/html.lua")
import("./layout/wp.lua")
import("./layout/docx.lua")
import("./layout/jats.lua")
import("./layout/odt.lua")
import("./layout/pptx.lua")
import("./layout/table.lua")
import("./layout/figures.lua")
import("./layout/cites.lua")
import("./layout/columns.lua")
import("./layout/manuscript.lua")

import("./layout/columns-preprocess.lua")
import("./layout/layout.lua")
import("./crossref/index.lua")
import("./crossref/preprocess.lua")
import("./crossref/sections.lua")
import("./crossref/figures.lua")
import("./crossref/tables.lua")
import("./crossref/equations.lua")
import("./crossref/listings.lua")
import("./crossref/theorems.lua")
import("./crossref/qmd.lua")
import("./crossref/refs.lua")
import("./crossref/meta.lua")
import("./crossref/format.lua")
import("./crossref/options.lua")

import("./quarto-pre/bibliography-formats.lua")
import("./quarto-pre/book-links.lua")
import("./quarto-pre/book-numbering.lua")
import("./quarto-pre/code-annotation.lua")
import("./quarto-pre/code-filename.lua")
import("./quarto-pre/engine-escape.lua")
import("./quarto-pre/figures.lua")
import("./quarto-pre/hidden.lua")
import("./quarto-pre/include-paths.lua")
import("./quarto-pre/input-traits.lua")
import("./quarto-pre/line-numbers.lua")
import("./quarto-pre/meta.lua")
import("./quarto-pre/options.lua")
import("./quarto-pre/output-location.lua")
import("./quarto-pre/outputs.lua")
import("./quarto-pre/panel-input.lua")
import("./quarto-pre/panel-layout.lua")
import("./quarto-pre/panel-sidebar.lua")
import("./quarto-pre/parsefiguredivs.lua")
import("./quarto-pre/project-paths.lua")
import("./quarto-pre/resourcefiles.lua")
import("./quarto-pre/results.lua")
import("./quarto-pre/shortcodes-handlers.lua")
import("./quarto-pre/table-classes.lua")
import("./quarto-pre/table-captions.lua")
import("./quarto-pre/table-colwidth.lua")
import("./quarto-pre/table-rawhtml.lua")
import("./quarto-pre/theorems.lua")

import("./customnodes/shortcodes.lua")
import("./customnodes/content-hidden.lua")
import("./customnodes/decoratedcodeblock.lua")
import("./customnodes/callout.lua")
import("./customnodes/panel-tabset.lua")
import("./customnodes/floatcrossref.lua")

-- [/import]

initCrossrefIndex()

initShortcodeHandlers()

local quartoInit = {
  { name = "init-configure-filters", filter = configure_filters() },
  { name = "init-read-includes", filter = read_includes() },
  { name = "init-metadata-resource-refs", filter = combineFilters({
    file_metadata(),
    resourceRefs()
  })},
}

local quartoNormalize = {
  { name = "normalize", filter = filterIf(function()
    return quarto_global_state.active_filters.normalization
  end, normalize_filter()) },

  { name = "pre-table-merge-raw-html", 
    filter = table_merge_raw_html()
  },

  { name = "pre-content-hidden-meta",
    filter = content_hidden_meta() },

  -- 2023-04-11: We want to combine these filters but parse_md_in_html_rawblocks
  -- can't be combined with parse_html_tables because combineFilters
  -- doesn't inspect the contents of the results in the inner loop.
  { name = "normalize-combined", filter = combineFilters({
      parse_html_tables(),
      parse_extended_nodes(),
    })
  },
  { 
    name = "normalize-extractQuartoDom", 
    filter = parse_md_in_html_rawblocks(),
  },
}

local quartoPre = {
  -- quarto-pre

  -- TODO we need to compute flags on the results of the user filters
  { name = "pre-run-user-filters", filters = make_wrapped_user_filters("beforeQuartoFilters") },

  -- do this early so we can compute maxHeading while in the big traversal
  { name = "crossref-init-crossref-options", filter = init_crossref_options() },

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

  { name = "pre-parse-figure-divs-into-floats",
    filter = parse_figure_divs_into_floats(),
  },

  { filter = { Pandoc = function(doc) print(pandoc.write(doc, "native")) end } },  

  -- { name = "pre-check-floatcrossref",
  --   filter = {
  --     FloatCrossref = function(float)
  --       print("<<<")
  --       quarto.utils.dump(float)
  --       print(">>>")
  --     end
  --   }
  -- },

  { name = "pre-bibliography-formats", filter = bibliography_formats() }, 
  
  { name = "pre-shortcodes-filter", 
    filter = shortcodes_filter(),
    flags = { "has_shortcodes" } },

  { name = "pre-table-colwidth-cell", 
    filter = table_colwidth_cell(),
    flags = { "has_tbl_colwidths" } },

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
    code_filename(),
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

local quartoPost = {
  -- quarto-post
  { name = "post-cell-cleanup", 
    filter = cell_cleanup(),
    flags = { "has_output_cells" } },
  { name = "post-cites", filter = indexCites() },
  { name = "post-foldCode", filter = foldCode() },
  { name = "post-bibliography", filter = bibliography() },
  { name = "post-figureCleanupCombined", filter = combineFilters({
    latexDiv(),
    responsive(),
    ipynb(),
    quartoBook(),
    reveal(),
    tikz(),
    pdfImages(),
    delink(),
    figCleanup(),
    responsive_table(),
  }) },
  { name = "post-ojs", filter = ojs() },
  { name = "post-postMetaInject", filter = quartoPostMetaInject() },
  
  { name = "post-render-jats", filter = filterIf(function()
    return quarto_global_state.active_filters.jats_subarticle == nil or not quarto_global_state.active_filters.jats_subarticle
  end, jats()) },
  { name = "post-render-jats-subarticle", filter = filterIf(function()
    return quarto_global_state.active_filters.jats_subarticle ~= nil and quarto_global_state.active_filters.jats_subarticle
  end, jatsSubarticle()) },

  -- format-specific rendering
  { name = "post-render-asciidoc", filter = render_asciidoc() },
  { name = "post-render-latex", filter = render_latex() },
  { name = "post-render-docx", filter = render_docx() },

  -- extensible rendering
  { name = "post-render_extended_nodes", filter = render_extended_nodes() },

  { name = "post-render-pandoc-3-figures", filter = render_pandoc3_figures() },
  { name = "post-userAfterQuartoFilters", filters = make_wrapped_user_filters("afterQuartoFilters") },
}

local quartoFinalize = {
    -- quarto-finalize
    { name = "finalize-fileMetadataAndMediabag", filter =
    combineFilters({
      file_metadata(),
      mediabag()
    })
  },
  { name = "finalize-bookCleanup", filter = bookCleanup() },
  { name = "finalize-cites", filter = writeCites() },
  { name = "finalize-metaCleanup", filter = metaCleanup() },
  { name = "finalize-dependencies", filter = dependencies() },
  { name = "finalize-wrapped-writer", filter = wrapped_writer() }
}

local quartoLayout = {
  { name = "manuscript filtering", filter = manuscript() },
  { name = "layout-columns-preprocess", filter = columns_preprocess() },
  { name = "layout-columns", filter = columns() },
  { name = "layout-cites-preprocess", filter = cites_preprocess() },
  { name = "layout-cites", filter = cites() },
  { name = "layout-panels", filter = layout_panels(), flags =
    { "has_layout_attributes", "has_tbl_parent" } },
  { name = "layout-extended-figures", filter = extended_figures(), flags = 
    { "has_discoverable_figures", "has_figure_divs"} },
  { name = "layout-meta-inject-latex-packages", filter = layout_meta_inject_latex_packages() }
}

local quartoCrossref = {

  { name = "crossref-preprocess", filter = crossref_preprocess(),
    flags = { 
      "has_figure_or_table_ref", 
      "has_discoverable_figures",
      "has_table_with_long_captions",
      "has_latex_table_captions"
    } },

  { name = "crossref-preprocessTheorems", 
    filter = crossref_preprocess_theorems(),
    flags = { "has_theorem_refs" } },

  { name = "crossref-combineFilters", filter = combineFilters({
    file_metadata(),
    qmd(),
    sections(),
    crossref_figures(),
    crossref_tables(),
    equations(),
    listings(),
    crossref_theorems(),
  })},

  { name = "crossref-resolveRefs", filter = resolveRefs(),
    flags = { "has_cites" } },
    
  { name = "crossref-crossrefMetaInject", filter = crossrefMetaInject() },
  { name = "crossref-writeIndex", filter = writeIndex() },
}

local filterList = {}

tappend(filterList, quartoInit)
tappend(filterList, quartoNormalize)
tappend(filterList, quartoPre)
tappend(filterList, quartoCrossref)
tappend(filterList, quartoLayout)
tappend(filterList, quartoPost)
tappend(filterList, quartoFinalize)

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

-- TODO!!
-- citeproc detection/toggle

--[[ from filters.ts:

// citeproc at the very end so all other filters can interact with citations
filters = filters.filter((filter) => filter !== kQuartoCiteProcMarker);
const citeproc = citeMethod(options) === kQuartoCiteProcMarker;
if (citeproc) {
  // If we're explicitely adding the citeproc filter, turn off
  // citeproc: true so it isn't run twice
  // See https://github.com/quarto-dev/quarto-cli/issues/2393
  if (options.format.pandoc.citeproc === true) {
    delete options.format.pandoc.citeproc;
  }

  quartoFilters.push(kQuartoCiteProcMarker);
}

]]
