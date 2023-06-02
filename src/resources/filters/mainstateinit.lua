-- mainstateinit.lua
-- initializes global state for the main.lua script
--
-- Copyright (C) 2022 by RStudio, PBC

-- global state
quarto_global_state = {
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

crossref = {
  usingTheorems = false,
  startAppendix = nil,

  -- initialize autolabels table
  autolabels = pandoc.List(),

  -- kinds are "float", "block", "inline", "anchor"
  categories = {
    by_prefix = {
      fig = {
        prefix = "fig",
        name = "Figure",
        kind = "float",
      },
      tbl = {
        prefix = "tbl",
        name = "Table",
        kind = "float",
      },
      lst = {
        prefix = "lst",
        name = "Listing",
        kind = "float",
      }
    
    -- eventually we'll have block kinds here
    -- with callouts + theorem envs

    -- eventually we'll have inline kinds here
    -- with equation refs

    -- eventually we'll have anchor kinds here
    -- with section/chapter/slide refs, etc
    }
  }
}
