-- quarto-post.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- required version
PANDOC_VERSION:must_be_at_least '2.13'

-- global state
postState = {}

-- [import]
function import(script)
  local path = PANDOC_SCRIPT_FILE:match("(.*[/\\])")
  dofile(path .. script)
end
import("responsive.lua")
import("latexdiv.lua")
import("foldcode.lua")
import("fig-cleanup.lua")
import("ipynb.lua")
import("ojs.lua")
import("reveal.lua")
import("tikz.lua")
import("meta.lua")
import("delink.lua")
import("book.lua")
import("svg.lua")
import("../common/lunacolors.lua")
import("../common/log.lua")
import("../common/base64.lua")
import("../common/table.lua")
import("../common/layout.lua")
import("../common/pandoc.lua")
import("../common/figures.lua")
import("../common/meta.lua")
import("../common/debug.lua")
import("../common/authors.lua")
import("../common/string.lua")
-- [/import]

return {
  foldCode(),
  combineFilters({
    latexDiv(),
    responsive(),
    ipynb(),
    quartoBook(),
    reveal(),
    tikz(),
    delink(),
    figCleanup(),
    svg()
  }),
  ojs(),
  quartoPostMetaInject(),
}



