-- custom.lua
-- Copyright (C) 2023 Posit Software, PBC
--
-- custom crossref categories

function initialize_custom_crossref_categories(meta)
  local cr = meta["crossref"]
  if pandoc.utils.type(cr) ~= "table" then
    return nil
  end
  local custom = cr["custom"]
  if custom == nil then
    return nil
  end
  if type(custom) ~= "table" then
    -- luacov: disable
    fail_and_ask_for_bug_report("crossref.custom entry must be a table")
    return nil
    -- luacov: enable
  end
  local keys = {
    "default-caption-location",
    "kind",
    "name",
    "prefix",
    "ref-type",
    "latex-env",
    "latex-list-of-name"
  }
  local obj_mapping = {
    ["default-caption-location"] = "default_caption_location",
    ["latex-env"] = "latex_env",
    ["latex-list-of-name"] = "latex_list_of_name",
    ["ref-type"] = "ref_type"
  }
  for _, v in ipairs(custom) do
    local entry = {}
    for _, key in ipairs(keys) do
      if v[key] ~= nil then
        entry[key] = pandoc.utils.stringify(v[key])
      end
    end
    if entry["default-caption-location"] == nil then
      entry["default-caption-location"] = "bottom"
    end
    -- slightly inefficient because we recompute the indices at
    -- every call, but should be totally ok for the number of categories
    -- we expect to see in documents
    local obj_entry = {}
    for k, v in pairs(entry) do
      if obj_mapping[k] ~= nil then
        obj_entry[obj_mapping[k]] = v
      else
        obj_entry[k] = v
      end
    end
    add_crossref_category(obj_entry)

    if quarto.doc.isFormat("pdf") then
      metaInjectLatex(meta, function(inject)
        local env_name = entry["latex-env"]
        local name = entry["name"]
        local env_prefix = entry["prefix"]
        local ref_type = entry["ref-type"]
        local list_of_name = entry["latex-list-of-name"]

        -- FIXME do we need different "lop" extensions for each category?
        -- we should be able to test this by creating a document with listings and diagrams
        
        inject(
        usePackage("float") .. "\n" ..
        "\\floatstyle{plain}\n" ..
        "\\@ifundefined{c@chapter}{\\newfloat{" .. env_name .. "}{h}{lop}}{\\newfloat{" .. env_name .. "}{h}{lop}[chapter]}\n" ..
        "\\floatname{".. env_name .. "}{" .. titleString(ref_type, env_prefix) .. "}\n"
        )
        inject(
          "\\newcommand*\\listof" .. env_name .. "s{\\listof{" .. env_name .. "}{" .. listOfTitle(list_of_name, "List of " .. name .. "s") .. "}}\n"
        )
      end)
    end
  end
end