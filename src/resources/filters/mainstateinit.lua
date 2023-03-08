-- mainstateinit.lua
-- initializes global state for the main.lua script
--
-- Copyright (C) 2022-2023 Posit, PBC

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
  emulatedNodeHandlers = {}
}

postState = {
}
