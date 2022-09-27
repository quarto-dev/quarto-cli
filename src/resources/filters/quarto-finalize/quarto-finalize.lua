-- quarto-finalize.lua
-- Copyright (C) 2020 by RStudio, PBC

-- required version
PANDOC_VERSION:must_be_at_least '2.13'

-- -- [import]
-- function import(script)
--   local path = PANDOC_SCRIPT_FILE:match("(.*[/\\])")
--   dofile(path .. script)
-- end
-- import("../common/base64.lua")
-- import("../common/pandoc.lua")
-- import("../common/meta.lua")
-- import("../common/filemetadata.lua")
-- import("../common/debug.lua")
-- import("meta-cleanup.lua")
-- import("book-cleanup.lua")
-- import("dependencies.lua")
-- import("mediabag.lua")
-- -- [/import]

-- return {
--   combineFilters({
--     fileMetadata(),
--     mediabag()
--   }),
--   bookCleanup(),
--   metaCleanup(),
--   dependencies()
-- }