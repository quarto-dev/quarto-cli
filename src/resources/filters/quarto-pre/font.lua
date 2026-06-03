-- font.lua
-- Copyright (C) 2020-2024 Posit Software, PBC

-- Normalize font fallback names for luaotfload.
--
-- luaotfload appends a ";-fallback" feature to every name passed to
-- add_fallback(). Its request grammar ends a font name at ":", "(" or "/",
-- so a name with none of those (e.g. "DejaVu Sans") swallows the appended
-- ";-fallback" into the name itself; the lookup fails, define_font returns
-- nil, and LuaLaTeX crashes dereferencing it. Appending ":" terminates the
-- name so the feature parses as a feature.
--
-- We append ":" ONLY when the name lacks a terminator, so documented forms
-- such as "FreeSans:" or "NotoColorEmoji:mode=harf" are left untouched.
function normalize_font_fallbacks()

  local fallback_keys = { "mainfontfallback", "sansfontfallback", "monofontfallback" }

  -- true when the name has no luaotfload name terminator
  local function needs_terminator(name)
    return name:find("[:(/]") == nil
  end

  -- a font name is plain text; stringify any meta scalar to text, append the
  -- terminating ":" when needed, and return it as a MetaString
  local function normalize_entry(entry)
    local name = pandoc.utils.stringify(entry)
    if name ~= "" and needs_terminator(name) then
      name = name .. ":"
    end
    return pandoc.MetaString(name)
  end

  return {
    Meta = function(meta)
      -- format is not resolved when this filter table is constructed, so the
      -- LaTeX gate must run here, not at construction time
      if not _quarto.format.isLatexOutput() then
        return nil
      end
      for _, key in ipairs(fallback_keys) do
        local val = meta[key]
        if val ~= nil then
          if quarto.utils.type(val) == "List" then
            local normalized = pandoc.List()
            for _, entry in ipairs(val) do
              normalized:insert(normalize_entry(entry))
            end
            meta[key] = pandoc.MetaList(normalized)
          else
            -- single scalar (string / Inlines): the template stringifies it too
            meta[key] = normalize_entry(val)
          end
        end
      end
      return meta
    end
  }
end
