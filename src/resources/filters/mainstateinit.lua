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
    all = {
      {
        default_caption_location = "bottom",
        kind = "float",
        name = "Figure",
        prefix = "Figure",
        ref_type = "fig",
      },
      {
        default_caption_location = "top",
        kind = "float",
        name = "Table",
        prefix = "Table",
        ref_type = "tbl",
      },
      {
        default_caption_location = "top",
        kind = "float",
        name = "Listing",
        prefix = "Listing",
        ref_type = "lst",
      }
    }
    
    -- eventually we'll have block kinds here
    -- with callouts + theorem envs

    -- eventually we'll have inline kinds here
    -- with equation refs

    -- eventually we'll have anchor kinds here
    -- with section/chapter/slide refs, etc
  }
}


-- set up crossref category indices
function setup_crossref_category_indices()
  crossref.categories.by_ref_type = {}
  crossref.categories.by_name = {}
  for _, category in ipairs(crossref.categories.all) do
    crossref.categories.by_ref_type[category.ref_type] = category
    crossref.categories.by_name[category.name] = category
  end
end

function add_crossref_category(category)
  table.insert(crossref.categories.all, category)
  setup_crossref_category_indices()
end

setup_crossref_category_indices() 