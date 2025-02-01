---@meta

---@module 'pandoc.image'
pandoc.image = {}

--[[
Returns a table containing the size and resolution of an image; throws an error if the given string is not an image, or if the size of the image cannot be determined.

The resulting table has four entries: width, height, dpi_horz, and dpi_vert.

The opts parameter, when given, should be either a WriterOptions object such as PANDOC_WRITER_OPTIONS, or a table with a dpi entry. It affects the calculation for vector image formats such as SVG.
]]
---@param imagedata string image data (such as returned by `pandoc.mediabag.fetch`)
---@return table
function pandoc.image.size(imagedata) end

--[[
Returns the format of an image as a lowercase string.

Formats recognized by pandoc include `png`, `gif`, `tiff`, `jpeg`, `pdf`, `svg`, `eps`, and` `emf`.

If the format is not recognized, the function returns nil.
]]
---@param imagedata string image data (such as returned by `pandoc.mediabag.fetch`)
---@return string|nil
function pandoc.image.format(imagedata) end

