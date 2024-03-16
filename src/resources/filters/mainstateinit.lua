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
  emulatedNodeHandlers = {},
  reader_options = {}
}

crossref = {
  using_theorems = false,
  startAppendix = nil,

  -- initialize autolabels table
  autolabels = pandoc.List(),

  -- store a subfloat index to be able to lookup by id later.
  subfloats = {},

  -- kinds are "float", "block", "inline", "anchor"
  categories = {
    all = {
      {
        caption_location = "bottom",
        kind = "float",
        name = "Figure",
        prefix = "Figure",
        latex_env = "figure",
        ref_type = "fig",
      },
      {
        caption_location = "top",
        kind = "float",
        name = "Table",
        prefix = "Table",
        latex_env = "table",
        ref_type = "tbl",
      },
      {
        caption_location = "top",
        kind = "float",
        name = "Listing",
        prefix = "Listing",
        latex_env = "codelisting",
        ref_type = "lst",
      },

      -- callouts
      {
        kind = "Block",
        name = "Note",
        prefix = "Note",
        ref_type = "nte",
      },
      {
        kind = "Block",
        name = "Warning",
        prefix = "Warning",
        ref_type = "wrn",
      },
      {
        kind = "Block",
        name = "Caution",
        prefix = "Caution",
        ref_type = "cau",
      },
      {
        kind = "Block",
        name = "Tip",
        prefix = "Tip",
        ref_type = "tip",
      },
      {
        kind = "Block",
        name = "Important",
        prefix = "Important",
        ref_type = "imp", -- this will look weird but we decided to do it for consistency with the original callout types
      },

      -- proof envs
      {
        kind = "Block",
        name = "Proof",
        prefix = "Proof",
        ref_type = "prf",
      },
      {
        kind = "Block",
        name = "Remark",
        prefix = "Remark",
        ref_type = "rem",
      },
      {
        kind = "Block",
        name = "Solution",
        prefix = "Solution",
        ref_type = "sol",
      },
    }
    
    -- eventually we'll have other block kinds here, specifically theorem envs

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