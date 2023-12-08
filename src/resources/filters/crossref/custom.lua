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
    ["caption-location"] = function(v) return pandoc.utils.stringify(v) end,
    ["kind"] = function(v) return pandoc.utils.stringify(v) end,
    ["reference-prefix"] = function(v) return pandoc.utils.stringify(v) end,
    ["caption-prefix"] = function(v) return pandoc.utils.stringify(v) end,
    ["key"] = function(v) return pandoc.utils.stringify(v) end,
    ["latex-env"] = function(v) return pandoc.utils.stringify(v) end,
    ["latex-list-of-file-extension"] = function(v) return pandoc.utils.stringify(v) end,
    ["latex-list-of-description"] = function(v) return pandoc.utils.stringify(v) end,
    ["space-before-numbering"] = function(v) return v end,
  }
  local obj_mapping = {
    ["caption-location"] = "caption_location",
    ["reference-prefix"] = "name",
    ["caption-prefix"] = "prefix",
    ["latex-env"] = "latex_env",
    ["latex-list-of-file-extension"] = "latex_list_of_file_extension",
    ["latex-list-of-description"] = "latex_list_of_description",
    ["key"] = "ref_type",
    ["space-before-numbering"] = "space_before_numbering",
  }
  for _, v in ipairs(custom) do
    local entry = {}
    for key, xform in pairs(keys) do
      if v[key] ~= nil then
        entry[key] = xform(v[key])
      end
    end
    if entry["caption-location"] == nil then
      entry["caption-location"] = "bottom"
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
    if obj_entry["prefix"] == nil then
      obj_entry["prefix"] = obj_entry["name"]
    end
    quarto.utils.dump{obj_entry = obj_entry}
    add_crossref_category(obj_entry)

    if quarto.doc.isFormat("pdf") then
      local function as_latex(inlines)
        return trim(pandoc.write(pandoc.Pandoc(inlines), "latex"))
      end
      metaInjectLatex(meta, function(inject)
        local env_name = entry["latex-env"]
        local name = entry["reference-prefix"]
        local env_prefix = entry["caption-prefix"] or name
        local ref_type = entry["key"]
        local list_of_name = entry["latex-list-of-file-extension"] or ("lo" .. ref_type)
        local list_of_description = entry["latex-list-of-description"] or name
        local cap_location = entry["caption-location"] or "bottom"
        local space_before_numbering = entry["space-before-numbering"]
        if space_before_numbering == nil then
          space_before_numbering = true
        end
        
        inject(
        usePackage("float") .. "\n" ..
        "\\floatstyle{plain}\n" ..
        "\\@ifundefined{c@chapter}{\\newfloat{" .. env_name .. "}{h}{" .. list_of_name .. "}}{\\newfloat{" .. env_name .. "}{h}{" .. list_of_name .. "}[chapter]}\n" ..
        "\\floatname{".. env_name .. "}{" .. as_latex(title(ref_type, env_prefix)) .. "}\n"
        )

        if cap_location == "top" then
          inject("\\floatstyle{plaintop}\n\\restylefloat{" .. env_name .. "}\n")
        end

        -- FIXME this is a bit of hack for the case of custom categories with
        -- space-before-numbering: false
        --
        -- the real unlock here is the custom ref command, which we should
        -- eventually just make extensible entirely by the user
        --
        -- and we should probably be using cleveref instead of hyperref

        if not space_before_numbering and name:match(" ") then
          -- extract last word from name
          local last_word = name:match("([^ ]+)$")
          local first_words = name:sub(1, #name - #last_word - 1)
          local custom_cmd_name = "quarto" .. ref_type .. "ref"
          local ref_command = "\\newcommand*\\" .. custom_cmd_name .. "[1]{" .. first_words .. " \\hyperref[#1]{" .. last_word .. "\\ref{#1}}}"
          inject(ref_command)

          -- mark crossref category as having a custom ref command
          -- so we can use it in the rendering
          crossref.categories.by_ref_type[ref_type].custom_ref_command = custom_cmd_name


          -- inject the caption package includes here because they need to appear before DeclareCaptionFormat
          inject(usePackage("caption"))
          -- also declare a custom caption format in this case, so caption
          -- format also skips spaces:
          inject("\\DeclareCaptionLabelFormat{" .. custom_cmd_name .. "labelformat}{#1#2}")
          inject("\\captionsetup[" .. env_name .. "]{labelformat=" .. custom_cmd_name .. "labelformat}")
        end

        inject(
          "\\newcommand*\\listof" .. env_name .. "s{\\listof{" .. env_name .. "}{" .. listOfTitle(list_of_name, "List of " .. list_of_description .. "s") .. "}}\n"
        )
      end)
    end
  end
end