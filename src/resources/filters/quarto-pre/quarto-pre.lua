-- quarto-pre.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

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
  fileSectionIds = {}
}


-- [import]
function import(script)
  local path = PANDOC_SCRIPT_FILE:match("(.*[/\\])")
  dofile(path .. script)
end
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
import("../common/timing.lua")
import("results.lua")
import("options.lua")
import("code-filename.lua")
import("shortcodes.lua")
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
import("callout.lua")
import("engine-escape.lua")
import("panel-sidebar.lua")
import("panel-tabset.lua")
import("panel-input.lua")
import("panel-layout.lua")
import("hidden.lua")
import("content-hidden.lua")
import("line-numbers.lua")
import("output-location.lua")
import("include-paths.lua")
import("input-traits.lua")
import("project-paths.lua")
-- [/import]

initShortcodeHandlers()

local filterList = {
  { name = "init", filter = init_options() },
  { name = "bibliography_formats", filter = bibliography_formats() },
  { name = "shortCodesBlocks", filter = shortCodesBlocks() } ,
  { name = "shortCodesInlines", filter = shortCodesInlines() },
  { name = "table_merge_raw_html", filter = table_merge_raw_html() },
  { name = "table_render_raw_html", filter = table_render_raw_html() },
  { name = "table_colwidth_cell", filter = table_colwidth_cell() },
  { name = "table_colwidth", filter = table_colwidth() },
  { name = "hidden", filter = hidden() },
  { name = "content_hidden", filter = content_hidden() },
  { name = "table_captions", filter = table_captions() },
  { name = "code-annotations", filter = combineFilters({
    code_meta(),
    code_annotations(),
    })},
  { name = "outputs", filter = unroll_cell_outputs() },
  { name = "outputLocation", filter = outputLocation() },
  { name = "combined-figures-theorems-etc", filter = combineFilters({
    fileMetadata(),
    indexBookFileTargets(),
    bookNumbering(),
    includePaths(),
    resourceFiles(),
    figures(),
    theorems(),
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
  { name = "projectPaths", filter = projectPaths()}
}

return capture_timings(filterList)
