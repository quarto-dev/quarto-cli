-- quarto-post.lua
-- Copyright (C) 2020 by RStudio, PBC

-- -- required version
-- PANDOC_VERSION:must_be_at_least '2.13'

-- -- global state
-- postState = {
--   extendedAstNodeHandlers = {}
-- }

-- -- [import]
-- function import(script)
--   local path = PANDOC_SCRIPT_FILE:match("(.*[/\\])")
--   dofile(path .. script)
-- end

-- import("../ast/normalize.lua") -- normalize must come before extended-nodes.lua
-- import("../ast/pandocwalk.lua") -- pandocwalk must come before extended-nodes.lua
-- import("../ast/extended-nodes.lua")
-- import("../ast/make-extended-filters.lua")
-- import("../ast/render.lua")
-- import("../common/authors.lua")
-- import("../common/base64.lua")
-- import("../common/debug.lua")
-- import("../common/figures.lua")
-- import("../common/layout.lua")
-- import("../common/log.lua")
-- import("../common/lunacolors.lua")
-- import("../common/map-or-call.lua")
-- import("../common/meta.lua")
-- import("../common/pandoc.lua")
-- import("../common/string.lua")
-- import("../common/table.lua")
-- import("../common/timing.lua")
-- import("../common/wrapped-filter.lua")
-- import("book.lua")
-- import("delink.lua")
-- import("fig-cleanup.lua")
-- import("foldcode.lua")
-- import("ipynb.lua")
-- import("latexdiv.lua")
-- import("meta.lua")
-- import("ojs.lua")
-- import("responsive.lua")
-- import("reveal.lua")
-- import("tikz.lua")

-- -- [/import]

-- local filterList = {
--   { name = "foldCode", filter = foldCode() },
--   { name = "figureCleanupCombined", filter = combineFilters({
--     latexDiv(),
--     responsive(),
--     ipynb(),
--     quartoBook(),
--     reveal(),
--     tikz(),
--     delink(),
--     figCleanup()
--   }) },
--   { name = "ojs", filter = ojs() },
--   { name = "postMetaInject", filter = quartoPostMetaInject() },
--   { name = "renderExtendedNodes", filter = renderExtendedNodes() },
--   { name = "userAfterQuartoFilters", filter = makeExtendedUserFilters("afterQuartoFilters") }
-- }

-- return run_as_extended_ast({
--   filters = capture_timings(filterList),
-- })
-- -- return capture_timings(filterList)

-- return {}