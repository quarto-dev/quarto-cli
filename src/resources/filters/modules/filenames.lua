-- filenames.lua
-- Copyright (C) 2024 Posit Software, PBC

-- helpers for working with filenames

local mime_img_extensions = {
  ["image/jpeg"]="jpg",
  ["image/gif"]="gif",
  ["image/vnd.microsoft.icon"]="ico",
  ["image/avif"]="avif",
  ["image/bmp"]="bmp",
  ["image/png"]="png",
  ["image/svg+xml"]="svg",
  ["image/tiff"]="tif",
  ["image/webp"]="webp",
}

local function filename_from_mime_type(filename, mime_type)
  -- Use the mime type to compute an extension when possible
  -- This will allow pandoc to properly know the type, even when 
  -- the path to the image is a difficult to parse URI
  local mimeExt = mime_img_extensions[mime_type]
  if mimeExt then
    local stem, _ext = pandoc.path.split_extension(filename)
    return stem .. '.' .. mimeExt
  else
    return filename
  end
end

-- replace invalid tex characters with underscores
local function tex_safe_filename(filename)
  -- return filename
  return filename:gsub("[ <>()|:&;#?*'\\/]", '-')
end

-- windows has a max path length of 260 characters
-- but we'll be conservative since we're sometimes appending a number
local function windows_safe_filename(filename)
  -- pull the first 200 characters without the extension
  local stem, ext = pandoc.path.split_extension(filename)
  local safeStem = stem:sub(1, 20)

  local result = safeStem .. ext

  if #ext > 40 then
    -- if the extension is too long, truncate it
    result = safeStem .. ext:sub(1, 40)
  end
  return result
end

return {
  filename_from_mime_type = filename_from_mime_type,
  tex_safe_filename = tex_safe_filename,
  windows_safe_filename = windows_safe_filename
}