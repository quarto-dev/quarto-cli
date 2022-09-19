---@meta

---@module 'pandoc.mediabag'

--[[
Removes a single entry from the media bag.
]]
---@param filepath string Path of the item to be deleted. The media bag will be left unchanged if no entry with the given filename exists.
function pandoc.mediabag.delete(filepath) end

--[[
Clear-out the media bag, deleting all items.
]]
function pandoc.mediabag.empty() end

--[[
Fills the mediabag with the images in the given document. An
image that cannot be retrieved will be replaced with a Span of
class "image" that contains the image description.

Images for which the mediabag already contains an item will
not be processed again.
]]
---@param doc pandoc.Pandoc Document from which to fill the mediabag
---@return pandoc.Pandoc # Modified document
function pandoc.mediabag.fill(doc) end


--[[
Adds a new entry to pandoc's media bag. Replaces any existing
mediabag entry with the same `filepath`.

Usage:

    local fp = "media/hello.txt"
    local mt = "text/plain"
    local contents = "Hello, World!"
    pandoc.mediabag.insert(fp, mt, contents)
]]
---@param filepath string Filename and path relative to the output folder.
---@param mime_type string|nil The file's MIME type; use `nil` if unknown or unavailable.
---@param contents string The binary contents of the file
function pandoc.mediabag.fill(filepath, mime_type, contents) end

--[[
Returns an iterator triple to be used with Lua's generic `for`
statement. The iterator returns the filepath, MIME type, and
content of a media bag item on each invocation. Items are
processed one-by-one to avoid excessive memory use.

This function should be used only when full access to all items,
including their contents, is required. For all other cases,
`list` should be preferred.

Returns:

-   The iterator function; must be called with the iterator
    state and the current iterator value.
-   Iterator state -- an opaque value to be passed to the
    iterator function.
-   Initial iterator value.

Usage:

    for fp, mt, contents in pandoc.mediabag.items() do
      -- print(fp, mt, contents)
    end
]]
---@return function,unknown,unknown 
function pandoc.mediabag.items() end


--[[
Get a summary of the current media bag contents.

Returns: A list of elements summarizing each entry in the media
bag. The summary item contains the keys `path`, `type`, and
`length`, giving the filepath, MIME type, and length of contents
in bytes, respectively.

Usage:

    -- calculate the size of the media bag.
    local mb_items = pandoc.mediabag.list()
    local sum = 0
    for i = 1, #mb_items do
        sum = sum + mb_items[i].length
    end
    print(sum)
]]
---@return {path: string, type: string, length: integer}[]
function pandoc.mediabag.list() end

--[[
Lookup a media item in the media bag, and return its MIME type
and contents.

Returns:

-   the entry's MIME type, or nil if the file was not found.
-   contents of the file, or nil if the file was not found.

Usage:

    local filename = "media/diagram.png"
    local mt, contents = pandoc.mediabag.lookup(filename)
]]
---@param filepath string Name of the file to look up.
---@return string|nil,string|nil 
function pandoc.mediabag.lookup(filepath) end

--[[
Fetches the given source from a URL or local file. Returns two
values: the contents of the file and the MIME type (or an empty
string).

The function will first try to retrieve `source` from the
mediabag; if that fails, it will try to download it or read it
from the local file system while respecting pandoc's "resource
path" setting.

Returns:

-   the entries MIME type, or nil if the file was not found.
-   contents of the file, or nil if the file was not found.

Usage:

    local diagram_url = "https://pandoc.org/diagram.jpg"
    local mt, contents = pandoc.mediabag.fetch(diagram_url)
]]
---@param source string Path to a resource; either a local file path or URI
---@return string|nil,string|nil 
function pandoc.mediabag.fetch(source) end
