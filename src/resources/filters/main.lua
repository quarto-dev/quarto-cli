-- main.lua
-- Copyright (C) 2020-2023 Posit Software, PBC

-- required version
PANDOC_VERSION:must_be_at_least '2.13'

crossref = {
  usingTheorems = false,
  startAppendix = nil
}

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

import("./common/authors.lua")
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
import("./common/license.lua")
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
import("./common/timing.lua")
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
import("./quarto-post/fig-cleanup.lua")
import("./quarto-post/foldcode.lua")
import("./quarto-post/ipynb.lua")
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
--import("./crossref/crossref.lua")

import("./quarto-pre/bibliography-formats.lua")
import("./quarto-pre/book-links.lua")
import("./quarto-pre/book-numbering.lua")
import("./quarto-pre/callout.lua")
import("./quarto-pre/code-annotation.lua")
import("./quarto-pre/code-filename.lua")
import("./quarto-pre/content-hidden.lua")
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
import("./quarto-pre/panel-tabset.lua")
import("./quarto-pre/project-paths.lua")
import("./quarto-pre/resourcefiles.lua")
import("./quarto-pre/results.lua")
import("./quarto-pre/shortcodes-handlers.lua")
import("./quarto-pre/shortcodes.lua")
import("./quarto-pre/table-classes.lua")
import("./quarto-pre/table-captions.lua")
import("./quarto-pre/table-colwidth.lua")
import("./quarto-pre/table-rawhtml.lua")
import("./quarto-pre/theorems.lua")

import("./customnodes/decoratedcodeblock.lua")

-- [/import]

initCrossrefIndex()

initShortcodeHandlers()

local quartoInit = {
  { name = "init-configure-filters", filter = configureFilters() },
  { name = "init-readIncludes", filter = readIncludes() },
  { name = "init-metadataResourceRefs", filter = combineFilters({
    fileMetadata(),
    resourceRefs()
  })},
}

local quartoNormalize = {
  { name = "normalize", filter = filterIf(function()
    return preState.active_filters.normalization
  end, normalizeFilter()) },
  { name = "normalize-parseHtmlTables", filter = parse_html_tables() },
  { name = "normalize-extractQuartoDom", filter = extract_quarto_dom() },
  { name = "normalize-parseExtendedNodes", filter = parseExtendedNodes() }
}

local quartoPre = {
  -- quarto-pre
  { name = "pre-quartoBeforeExtendedUserFilters", filters = make_wrapped_user_filters("beforeQuartoFilters") },

  -- https://github.com/quarto-dev/quarto-cli/issues/5031
  -- recompute options object in case user filters have changed meta
  -- this will need to change in the future; users will have to indicate
  -- when they mutate options
  { name = "pre-quartoAfterUserFilters", filter = initOptions() },

  { name = "normalize-parse-pandoc3-figures", filter = parse_pandoc3_figures() },
  { name = "pre-bibliographyFormats", filter = bibliographyFormats() }, 
  { name = "pre-shortCodesBlocks", filter = shortCodesBlocks() } ,
  { name = "pre-shortCodesInlines", filter = shortCodesInlines() },
  { name = "pre-tableMergeRawHtml", filter = tableMergeRawHtml() },
  { name = "pre-tableRenderRawHtml", filter = tableRenderRawHtml() },
  { name = "pre-tableColwidthCell", filter = tableColwidthCell() },
  { name = "pre-tableColwidth", filter = tableColwidth() },
  { name = "pre-tableClasses", filter = tableClasses() },
  { name = "pre-hidden", filter = hidden() },
  { name = "pre-contentHidden", filter = contentHidden() },
  { name = "pre-tableCaptions", filter = tableCaptions() },
  { name = "pre-longtable_no_caption_fixup", filter = longtable_no_caption_fixup() },
  { name = "pre-code-annotations", filter = code()},
  { name = "pre-code-annotations-meta", filter = codeMeta()},
  { name = "pre-outputs", filter = outputs() },
  { name = "pre-outputLocation", filter = outputLocation() },
  { name = "pre-combined-figures-theorems-etc", filter = combineFilters({
    fileMetadata(),
    indexBookFileTargets(),
    bookNumbering(),
    includePaths(),
    resourceFiles(),
    quartoPreFigures(),
    quartoPreTheorems(),
    callout(),
    codeFilename(),
    lineNumbers(),
    engineEscape(),
    panelInput(),
    panelLayout(),
    panelSidebar(),
    inputTraits()
  }) },
  { name = "pre-combined-book-file-targets", filter = combineFilters({
    fileMetadata(),
    resolveBookFileTargets(),
  }) },
  { name = "pre-quartoPreMetaInject", filter = quartoPreMetaInject() },
  { name = "pre-writeResults", filter = writeResults() },
  { name = "pre-projectPaths", filter = projectPaths() }
}

local quartoPost = {
  -- quarto-post
  { name = "post-cell-cleanup", filter = cell_cleanup() },
  { name = "post-cites", filter = indexCites() },
  { name = "post-foldCode", filter = foldCode() },
  { name = "post-bibligraphy", filter = bibliography() },
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
    return preState.active_filters.jats_subarticle ~= nil and not preState.active_filters.jats_subarticle
  end, jats()) },
  { name = "post-render-jats-subarticle", filter = filterIf(function()
    return preState.active_filters.jats_subarticle ~= nil and preState.active_filters.jats_subarticle
  end, jatsSubarticle()) },  
  { name = "post-render-asciidoc", filter = renderAsciidoc() },
  { name = "post-renderExtendedNodes", filter = renderExtendedNodes() },
  { name = "post-render-pandoc-3-figures", filter = render_pandoc3_figures() },
  { name = "post-userAfterQuartoFilters", filters = make_wrapped_user_filters("afterQuartoFilters") },
}

local quartoFinalize = {
    -- quarto-finalize
    { name = "finalize-fileMetadataAndMediabag", filter =
    combineFilters({
      fileMetadata(),
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
  { name = "layout-columnsPreprocess", filter = columnsPreprocess() },
  { name = "layout-columns", filter = columns() },
  { name = "layout-citesPreprocess", filter = citesPreprocess() },
  { name = "layout-cites", filter = cites() },
  { name = "layout-panels", filter = layoutPanels() },
  { name = "layout-extendedFigures", filter = extendedFigures() },
  { name = "layout-metaInject", filter = layoutMetaInject() }
}

local quartoCrossref = {
  { name = "crossref-initCrossrefOptions", filter = initCrossrefOptions() },
  { name = "crossref-preprocess", filter = crossrefPreprocess() },
  { name = "crossref-preprocessTheorems", filter = crossrefPreprocessTheorems() },
  { name = "crossref-combineFilters", filter = combineFilters({
    fileMetadata(),
    qmd(),
    sections(),
    crossrefFigures(),
    crossrefTables(),
    equations(),
    listings(),
    crossrefTheorems(),
  })},
  { name = "crossref-resolveRefs", filter = resolveRefs() },
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

local profiler = require("profiler")

local result = run_as_extended_ast({
  pre = {
    initOptions()
  },
  afterFilterPass = function() 
    -- After filter pass is called after each pass through a filter group
    -- allowing state or other items to be handled
    resetFileMetadata()
  end,
  filters = capture_timings(filterList),
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
