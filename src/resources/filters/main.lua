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
import("./common/collate.lua")
import("./common/crossref.lua")
import("./common/debug.lua")
import("./common/error.lua")
import("./common/figures.lua")
import("./common/filemetadata.lua")
import("./common/floats.lua")
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
import("./quarto-init/knitr-fixup.lua")

import("./quarto-post/render-asciidoc.lua")
import("./quarto-post/book.lua")
import("./quarto-post/cites.lua")
import("./quarto-post/delink.lua")
import("./quarto-post/docx.lua")
import("./quarto-post/fig-cleanup.lua")
import("./quarto-post/foldcode.lua")
import("./quarto-post/gfm.lua")
import("./quarto-post/ipynb.lua")
import("./quarto-post/latex.lua")
import("./quarto-post/typst.lua")
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
import("./quarto-post/code.lua")
import("./quarto-post/html.lua")
import("./quarto-post/dashboard.lua")
import("./quarto-post/email.lua")

import("./quarto-finalize/dependencies.lua")
import("./quarto-finalize/book-cleanup.lua")
import("./quarto-finalize/mediabag.lua")
import("./quarto-finalize/meta-cleanup.lua")
import("./quarto-finalize/coalesceraw.lua")
import("./quarto-finalize/descaffold.lua")
import("./quarto-finalize/typst.lua")

import("./normalize/flags.lua")
import("./normalize/normalize.lua")
import("./normalize/parsehtml.lua")
import("./normalize/extractquartodom.lua")
import("./normalize/astpipeline.lua")
import("./normalize/capturereaderstate.lua")
import("./normalize/fixupdatauri.lua")

import("./layout/meta.lua")
import("./layout/width.lua")
import("./layout/wp.lua")
import("./layout/odt.lua")
import("./layout/pptx.lua")
import("./layout/table.lua")
import("./layout/figures.lua")
import("./layout/cites.lua")
import("./layout/columns.lua")
import("./layout/manuscript.lua")
import("./layout/pandoc3_figure.lua")
import("./layout/lightbox.lua")

import("./layout/columns-preprocess.lua")
import("./layout/layout.lua")
import("./crossref/custom.lua")
import("./crossref/index.lua")
import("./crossref/preprocess.lua")
import("./crossref/sections.lua")
import("./crossref/figures.lua")
import("./crossref/tables.lua")
import("./crossref/equations.lua")
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
import("./quarto-pre/parseblockreftargets.lua")
import("./quarto-pre/project-paths.lua")
import("./quarto-pre/resourcefiles.lua")
import("./quarto-pre/results.lua")
import("./quarto-pre/shiny.lua")
import("./quarto-pre/shortcodes-handlers.lua")
import("./quarto-pre/table-classes.lua")
import("./quarto-pre/table-captions.lua")
import("./quarto-pre/table-colwidth.lua")
import("./quarto-pre/table-rawhtml.lua")
import("./quarto-pre/theorems.lua")

import("./customnodes/panellayout.lua")

import("./layout/html.lua")
import("./layout/latex.lua")
import("./layout/docx.lua")
import("./layout/jats.lua")
import("./layout/asciidoc.lua")

import("./customnodes/latexenv.lua")
import("./customnodes/latexcmd.lua")
import("./customnodes/htmltag.lua")
import("./customnodes/shortcodes.lua")
import("./customnodes/content-hidden.lua")
import("./customnodes/decoratedcodeblock.lua")
import("./customnodes/callout.lua")
import("./customnodes/panel-tabset.lua")
import("./customnodes/floatreftarget.lua")
import("./customnodes/theorem.lua")
import("./customnodes/proof.lua")

import("./layout/confluence.lua")
import("./layout/ipynb.lua")
import("./layout/typst.lua")
import("./layout/hugo.lua")

import("./quarto-init/metainit.lua")

-- [/import]

initCrossrefIndex()

initShortcodeHandlers()

-- see whether the cross ref filter is enabled
local enableCrossRef = param("enable-crossref", true)

local quarto_init_filters = {
  { name = "init-quarto-meta-init", filter = quarto_meta_init() },
  { name = "init-quarto-custom-meta-init", filter = {
    Meta = function(meta)
      content_hidden_meta(meta)
    end
  }},
  -- FIXME this could probably be moved into the next combineFilters below,
  -- in quartoNormalize
  { name = "init-metadata-resource-refs", filter = combineFilters({
    file_metadata(),
    resourceRefs()
  })},
  { name = "init-knitr-syntax-fixup", filter = filterIf(
      -- only do those fix-up when we know computation engine was knitr
      function() return param("execution-engine") == "knitr" end, 
      knitr_fixup()
    )
  },
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

  { name = "normalize-capture-reader-state", filter = normalize_capture_reader_state() }
}

tappend(quarto_normalize_filters, quarto_ast_pipeline())

local quarto_pre_filters = {
  -- quarto-pre
  { name = "flags", filter = compute_flags() },

  { name = "pre-server-shiny", filter = server_shiny() },

  -- https://github.com/quarto-dev/quarto-cli/issues/5031
  -- recompute options object in case user filters have changed meta
  -- this will need to change in the future; users will have to indicate
  -- when they mutate options
  { name = "pre-read-options-again", filter = init_options() },

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
    engine_escape(),
    line_numbers(),
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

local quarto_post_filters = {
  { name = "post-cell-cleanup", 
    filter = cell_cleanup(),
    flags = { "has_output_cells" } },
  { name = "post-cites", filter = indexCites() },
  { name = "post-bibliography", filter = bibliography() },
  { name = "post-ipynb", filters = ipynb()},
  { name = "post-figureCleanupCombined", filter = combineFilters({
    latexDiv(),
    responsive(),
    quartoBook(),
    reveal(),
    tikz(),
    pdfImages(),
    delink(),
    figCleanup(),
    responsive_table(),
  }) },

  { name = "post-postMetaInject", filter = quartoPostMetaInject() },
  
  { name = "post-render-jats", filter = filterIf(function()
    return quarto_global_state.active_filters.jats_subarticle == nil or not quarto_global_state.active_filters.jats_subarticle
  end, jats()) },
  { name = "post-render-jats-subarticle", filter = filterIf(function()
    return quarto_global_state.active_filters.jats_subarticle ~= nil and quarto_global_state.active_filters.jats_subarticle
  end, jatsSubarticle()) },

  { name = "post-code-options", filter = filterIf(function() 
    return param("clear-cell-options", false) == true
  end, removeCodeOptions()) },

  -- format-specific rendering
  { name = "post-render-asciidoc", filter = render_asciidoc() },
  { name = "post-render-latex", filter = render_latex() },
  { name = "post-render-typst", filters = render_typst() },
  { name = "post-render-dashboard", filters = render_dashboard() },

  { name = "post-ojs", filter = ojs() },

  { name = "post-render-pandoc3-figure", filter = render_pandoc3_figure(),
    flags = { "has_pandoc3_figure" } },

  -- extensible rendering
  { name = "post-render_extended_nodes", filter = render_extended_nodes() },

  -- inject required packages post-rendering
  { name = "layout-meta-inject-latex-packages", filter = layout_meta_inject_latex_packages() },

  -- format fixups post rendering
  { name = "post-render-latex-fixups", filter = render_latex_fixups() },
  { name = "post-render-html-fixups", filter = render_html_fixups() },
  { name = "post-render-ipynb-fixups", filter = render_ipynb_fixups() },
  { name = "post-render-typst-fixups", filter = render_typst_fixups() },
  { name = "post-render-gfm-fixups", filter = render_gfm_fixups() },
  { name = "post-render-hugo-fixups", filter = render_hugo_fixups() },
  { name = "post-render-email", filters = render_email() },
}

local quarto_finalize_filters = {
  -- quarto-finalize
  { name = "finalize-combined", filter =
    combineFilters({
      file_metadata(),
      mediabag(),
      inject_vault_content_into_rawlatex(),
    })},
  { name = "finalize-bookCleanup", filter = bookCleanup() },
  { name = "finalize-cites", filter = writeCites() },
  { name = "finalize-metaCleanup", filter = metaCleanup() },
  { name = "finalize-dependencies", filter = dependencies() },
  { name = "finalize-coalesce-raw", filters = coalesce_raw() },
  { name = "finalize-descaffold", filter = descaffold() },
  { name = "finalize-wrapped-writer", filter = wrapped_writer() },
  { name = "finalize-typst-state", filter = setup_typst_state() }
}

local quarto_layout_filters = {
  { name = "manuscript filtering", filter = manuscript() },
  { name = "manuscript filtering", filter = manuscriptUnroll() },
  { name = "layout-lightbox", filters = lightbox(), flags = { "has_lightbox" }},
  { name = "layout-columns-preprocess", filter = columns_preprocess() },
  { name = "layout-columns", filter = columns() },
  { name = "layout-cites-preprocess", filter = cites_preprocess() },
  { name = "layout-cites", filter = cites() },
  { name = "layout-panels", filter = layout_panels() },
  { name = "post-fold-code-and-lift-codeblocks-from-floats", filter = fold_code_and_lift_codeblocks() },
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
    crossref_callouts(),
  })},

  { name = "crossref-resolveRefs", filter = resolveRefs(),
    flags = { "has_cites" } },
    
  { name = "crossref-crossrefMetaInject", filter = crossrefMetaInject() },
  { name = "crossref-writeIndex", filter = writeIndex() },
}

local quarto_filter_list = {}

table.insert(quarto_filter_list, { name = "pre-ast", filter = {} }) -- entry point for user filters
tappend(quarto_filter_list, quarto_init_filters)
tappend(quarto_filter_list, quarto_normalize_filters)
table.insert(quarto_filter_list, { name = "post-ast", filter = {} }) -- entry point for user filters

table.insert(quarto_filter_list, { name = "pre-quarto", filter = {} }) -- entry point for user filters
tappend(quarto_filter_list, quarto_pre_filters)
if enableCrossRef then
  tappend(quarto_filter_list, quarto_crossref_filters)
end
table.insert(quarto_filter_list, { name = "post-quarto", filter = {} }) -- entry point for user filters
table.insert(quarto_filter_list, { name = "pre-render", filter = {} }) -- entry point for user filters
tappend(quarto_filter_list, quarto_layout_filters)
tappend(quarto_filter_list, quarto_post_filters)
table.insert(quarto_filter_list, { name = "post-render", filter = {} }) -- entry point for user filters
table.insert(quarto_filter_list, { name = "pre-finalize", filter = {} }) -- entry point for user filters
tappend(quarto_filter_list, quarto_finalize_filters)
table.insert(quarto_filter_list, { name = "post-finalize", filter = {} }) -- entry point for user filters

-- now inject user-defined filters on appropriate positions
inject_user_filters_at_entry_points(quarto_filter_list)

local result = run_as_extended_ast({
  pre = {
    init_options()
  },
  afterFilterPass = function() 
    -- After filter pass is called after each pass through a filter group
    -- allowing state or other items to be handled
    resetFileMetadata()
  end,
  filters = quarto_filter_list,
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
