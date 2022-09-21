---@meta

---@module 'pandoc.path'
pandoc.path = {}

--[[
The character that separates directories.
]]
pandoc.path.separator = '/'

--[[
The character that is used to separate the entries in the `PATH`
environment variable.
]]
pandoc.path.search_path_separator = ':'

--[[
Gets the directory name, i.e., removes the last directory
separator and everything after from the given path.
]]
---@param filepath string 
---@return string # The filepath up to the last directory separator.
function pandoc.path.directory(filepath) end

--[[
Get the file name.
]]
---@param filepath string 
---@return string # File name part of the input path.
function pandoc.path.filename(filepath) end

--[[
Checks whether a path is absolute, i.e. not fixed to a root.
]]
---@param filepath string 
---@return boolean # `true` if `filepath` is an absolute path, `false` otherwise.
function pandoc.path.is_absolute(filepath) end

--[[
Checks whether a path is relative or fixed to a root.
]]
---@param filepath string 
---@return boolean # `true` if `filepath` is a relative path, `false` otherwise.
function pandoc.path.is_relative(filepath) end

--[[
Join path elements back together by the directory separator.
]]
---@param filepaths table Path components
---@return string # The joined path
function pandoc.path.join(filepaths) end


--[[
Contract a filename, based on a relative path. Note that the
resulting path will usually not introduce `..` paths, as the
presence of symlinks means `../b` may not reach `a/b` if it starts
from `a/c`. For a worked example see [this blog
post](https://neilmitchell.blogspot.co.uk/2015/10/filepaths-are-subtle-symlinks-are-hard.html).
]]
---@param path string Path to be made relative
---@param root string Root path
---@param unsafe? boolean Whether to allow `..` in the result.
---@return string # Contracted filename 
function pandoc.path.make_relative(path, root, unsafe) end

--[[
Normalizes a path.

-   `//` makes sense only as part of a (Windows) network drive;
    elsewhere, multiple slashes are reduced to a single
    `path.separator` (platform dependent).
-   `/` becomes `path.separator` (platform dependent)
-   `./` -\> ''
-   an empty path becomes `.`
]]
---@param filepath string Path to file
---@return string # The normalized path.
function pandoc.path.normalize(filepath) end

--[[
Splits a path by the directory separator.
]]
---@param filepath string Path to file
---@return table # List of all path components
function pandoc.path.split(filepath) end

--[[
Splits the last extension from a file path and returns the parts. The
extension, if present, includes the leading separator; if the path has
no extension, then the empty string is returned as the extension.

Returns:

-   filepath without extension (string)
-   extension or empty string (string)
]]
---@param filepath string Path to file
---@return string,string  
function pandoc.path.split_extension(filepath) end

--[[
Takes a string and splits it on the `search_path_separator` character.
Blank items are ignored on Windows, and converted to `.` on Posix. On
Windows path elements are stripped of quotes.
]]
---@param search_path string Platform-specific search path
---@return table # List of directories in search path
function pandoc.path.split_search_path(search_path) end


return pandoc.path