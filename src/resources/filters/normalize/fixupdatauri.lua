-- fixupdatauri.lua
-- Copyright (C) 2023 Posit Software, PBC

-- https://github.com/quarto-dev/quarto-cli/issues/6568
-- https://github.com/quarto-dev/quarto-cli/issues/6092
function normalize_fixup_data_uri_image_extension()
  return {
    Image = function(img)
      local ext = PANDOC_READER_OPTIONS.default_image_extension
      -- Nothing was appended when there is no default extension.
      if not ext or ext == "" then
        return nil
      end
      local src = img.src
      local suffix = "." .. ext

      -- Data URIs never need an extension, but Pandoc appends one anyway (#6568).
      if src:sub(1, 5) == "data:" then
        if src:sub(-#suffix) == suffix then
          img.src = src:sub(1, -#suffix - 1)
          return img
        end
        return nil
      end

      -- An http(s) URL whose path ends with a slash has no filename, so the
      -- appended default extension is provably spurious -- e.g.
      -- https://example.com/ is parsed as https://example.com/.png (#6092).
      -- A URL with a non-empty last segment is indistinguishable from a real
      -- file of that extension, so it is deliberately left untouched.
      if src:sub(1, 4) == "http" and src:match("^https?://")
         and src:sub(-#suffix - 1) == "/" .. suffix then
        img.src = src:sub(1, -#suffix - 1)
        return img
      end
    end
  }
end
