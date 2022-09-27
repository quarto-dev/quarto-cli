-- quarto-pre.lua
-- Copyright (C) 2020 by RStudio, PBC

-- required version
PANDOC_VERSION:must_be_at_least '2.13'

-- global state
preState = {
  usingBookmark = false,
  usingTikz = false,
  results = {
    resourceFiles = pandoc.List({}),
    inputTraits = {}
  },
  file = nil,
  appendix = false,
  fileSectionIds = {},
  extendedAstNodeHandlers = {}
}

postState = {
}

-- [import]
function import(script)
  local path = PANDOC_SCRIPT_FILE:match("(.*[/\\])")
  dofile(path .. script)
end

import("../ast/nodeinfo.lua") -- must come before extended-nodes.lua
import("../ast/normalize.lua") -- must come before extended-nodes.lua
import("../ast/pandocwalk.lua") -- must come before extended-nodes.lua
import("../ast/extended-nodes.lua")
import("../ast/make-extended-filters.lua")
import("../ast/parse.lua")
import("../ast/render.lua")
import("../ast/run-as-extended-ast.lua")

import("../common/authors.lua")
import("../common/base64.lua")
import("../common/colors.lua")
import("../common/debug.lua")
import("../common/error.lua")
import("../common/figures.lua")
import("../common/filemetadata.lua")
import("../common/format.lua")
import("../common/latex.lua")
import("../common/layout.lua")
import("../common/list.lua")
import("../common/log.lua")
import("../common/lunacolors.lua")
import("../common/map-or-call.lua")
import("../common/meta.lua")
import("../common/options.lua")
import("../common/pandoc.lua")
import("../common/paths.lua")
import("../common/refs.lua")
import("../common/string.lua")
import("../common/table.lua")
import("../common/tables.lua")
import("../common/theorems.lua")
import("../common/timing.lua")
import("../common/url.lua")
import("../common/validate.lua")
import("../common/wrapped-filter.lua")

import("../quarto-init/includes.lua")
import("../quarto-init/resourcerefs.lua")

import("../quarto-post/book.lua")
import("../quarto-post/delink.lua")
import("../quarto-post/fig-cleanup.lua")
import("../quarto-post/foldcode.lua")
import("../quarto-post/ipynb.lua")
import("../quarto-post/latexdiv.lua")
import("../quarto-post/meta.lua")
import("../quarto-post/ojs.lua")
import("../quarto-post/responsive.lua")
import("../quarto-post/reveal.lua")
import("../quarto-post/tikz.lua")

import("../quarto-finalize/dependencies.lua")
import("../quarto-finalize/book-cleanup.lua")
import("../quarto-finalize/mediabag.lua")
import("../quarto-finalize/meta-cleanup.lua")

import("../authors/authors.lua")

import("../layout/meta.lua")
import("../layout/width.lua")
import("../layout/latex.lua")
import("../layout/html.lua")
import("../layout/wp.lua")
import("../layout/docx.lua")
import("../layout/odt.lua")
import("../layout/pptx.lua")
import("../layout/table.lua")
import("../layout/figures.lua")
import("../layout/cites.lua")
import("../layout/columns.lua")
import("../layout/options.lua")
import("../layout/columns-preprocess.lua")
import("../layout/layout.lua")

import("../crossref/index.lua")
import("../crossref/preprocess.lua")
import("../crossref/sections.lua")
import("../crossref/figures.lua")
import("../crossref/tables.lua")
import("../crossref/equations.lua")
import("../crossref/listings.lua")
import("../crossref/theorems.lua")
import("../crossref/qmd.lua")
import("../crossref/refs.lua")
import("../crossref/meta.lua")
import("../crossref/format.lua")
import("../crossref/options.lua")
import("../crossref/crossref.lua")
initCrossrefIndex()

import("bibliography-formats.lua")
import("book-links.lua")
import("book-numbering.lua")
import("callout.lua")
import("code-filename.lua")
import("content-hidden.lua")
import("engine-escape.lua")
import("figures.lua")
import("hidden.lua")
import("include-paths.lua")
import("input-traits.lua")
import("line-numbers.lua")
import("meta.lua")
import("options.lua")
import("output-location.lua")
import("outputs.lua")
import("panel-input.lua")
import("panel-layout.lua")
import("panel-sidebar.lua")
import("panel-tabset.lua")
import("profile.lua")
import("project-paths.lua")
import("resourcefiles.lua")
import("results.lua")
import("shortcodes-handlers.lua")
import("shortcodes.lua")
import("table-captions.lua")
import("table-colwidth.lua")
import("table-rawhtml.lua")
import("theorems.lua")

-- [/import]

initShortcodeHandlers()

local quartoInit = {
  { name = "readIncludes", filter = readIncludes() },
  { name = "metadataResourceRefs", filter = combineFilters({
    fileMetadata(),
    resourceRefs()
  })},
}

local quartoAuthors = {
  { name = "authors", filter = authorsFilter() }
}

local quartoPre = {
  -- quarto-pre
  { name = "parseExtendedNodes", filter = parseExtendedNodes() },
  { name = "quartoBeforeExtendedUserFilters", filters = makeExtendedUserFilters("beforeQuartoFilters") },
  { name = "bibliographyFormats", filter = bibliographyFormats() }, 
  { name = "shortCodesBlocks", filter = shortCodesBlocks() } ,
  { name = "shortCodesInlines", filter = shortCodesInlines() },
  { name = "tableMergeRawHtml", filter = tableMergeRawHtml() },
  { name = "tableRenderRawHtml", filter = tableRenderRawHtml() },
  { name = "tableColwidthCell", filter = tableColwidthCell() },
  { name = "tableColwidth", filter = tableColwidth() },
  { name = "hidden", filter = hidden() },
  { name = "contentHidden", filter = contentHidden() },
  { name = "tableCaptions", filter = tableCaptions() },
  { name = "outputs", filter = outputs() },
  { name = "outputLocation", filter = outputLocation() },
  { name = "combined-figures-theorems-etc", filter = combineFilters({
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
    panelTabset(),
    panelLayout(),
    panelSidebar(),
    inputTraits()
  }) },
  { name = "combined-book-file-targets", filter = combineFilters({
    fileMetadata(),
    resolveBookFileTargets(),
  }) },
  { name = "quartoPreMetaInject", filter = quartoPreMetaInject() },
  { name = "writeResults", filter = writeResults() },
  { name = "projectPaths", filter = projectPaths()},
}

local quartoPost = {
  -- quarto-post
  { name = "foldCode", filter = foldCode() },
  { name = "figureCleanupCombined", filter = combineFilters({
    latexDiv(),
    responsive(),
    ipynb(),
    quartoBook(),
    reveal(),
    tikz(),
    delink(),
    figCleanup()
  }) },
  { name = "ojs", filter = ojs() },
  { name = "postMetaInject", filter = quartoPostMetaInject() },
  { name = "renderExtendedNodes", filter = renderExtendedNodes() },
  { name = "userAfterQuartoFilters", filter = makeExtendedUserFilters("afterQuartoFilters") },
}

local quartoFinalize = {
    -- quarto-finalize
    { name = "fileMetadataAndMediabag", filter =
    combineFilters({
      fileMetadata(),
      mediabag()
    })
  },
  { name = "bookCleanup", filter = bookCleanup() },
  { name = "metaCleanup", filter = metaCleanup() },
  { name = "dependencies", filter = dependencies() },
}

local quartoLayout = {
  { name = "columnsPreprocess", filter = columnsPreprocess() },
  { name = "columns", filter = columns() },
  { name = "citesPreprocess", filter = citesPreprocess() },
  { name = "cites", filter = cites() },
  { name = "layoutPanels", filter = layoutPanels() },
  { name = "extendedFigures", filter = extendedFigures() },
  { name = "layoutMetaInject", filter = layoutMetaInject() }
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
tappend(filterList, quartoAuthors) -- FIXME only run when enabled.
tappend(filterList, quartoPre)
tappend(filterList, quartoCrossref) -- FIXME only run when enabled.
tappend(filterList, quartoLayout)
tappend(filterList, quartoPost)
tappend(filterList, quartoFinalize)

return run_as_extended_ast({
  pre = {
    initOptions()
  },
  filters = capture_timings(filterList, true),
})
