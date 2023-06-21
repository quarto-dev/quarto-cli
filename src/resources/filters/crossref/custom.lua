-- custom.lua
-- Copyright (C) 2023 Posit Software, PBC
--
-- custom crossref categories

function initialize_custom_crossref_categories(meta)
  -- return {
  --   Meta = function(meta)
  if meta["crossref-custom"] == nil then
    return nil
  end
  if type(meta["crossref-custom"]) ~= "table" then
    fail("crossref-custom must be a table")
    return nil
  end
  local keys = {
    "default_caption_location",
    "kind",
    "name",
    "prefix",
    "ref_type",
  }
  for _, v in ipairs(meta["crossref-custom"]) do
    local entry = {}
    for _, key in ipairs(keys) do
      if v[key] ~= nil then
        entry[key] = pandoc.utils.stringify(v[key])
      end
    end
    if entry["default_caption_location"] == nil then
      entry["default_caption_location"] = "bottom"
    end
    -- slightly inefficient because we recompute the indices at
    -- every call, but should be totally ok for the number of categories
    -- we expect to see in documents
    add_crossref_category(entry)
  end
  --   end
  -- }
end