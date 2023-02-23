---@meta

---@module 'pandoc.zip'
pandoc.zip = {}

--[[
Reads an *Archive* structure from a raw zip archive or a list of
Entry items; throws an error if the given string cannot be decoded
into an archive.
]]

---@param bytestring_or_entries string|pandoc.zip.Entry[]
---@return pandoc.zip.Archive
function pandoc.zip.Archive(bytestring_or_entries) end

--[[
Generates a zip Entry from a filepath, the file's uncompressed
content, and the file's modification time.
]]
---@param path string file path in archive
---@param contents string uncompressed contents
---@param modtime? integer modification time
---@return pandoc.zip.Entry
function pandoc.zip.Entry(path, contents, modtime) end

--[[
Package and compress the given files into a new Archive.
]]
---@param filepaths string[] list of files from which the archive is created.
---@param options? table zip options
---@return pandoc.zip.Archive
function pandoc.zip.zip(filepaths, options) end

---@class pandoc.zip.Archive
---@field entries pandoc.zip.Entry[] files in this zip archive

--[[
Extract all files from this archive, creating directories as
needed. Note that the last-modified time is set correctly only
in POSIX, not in Windows. This function fails if encrypted
entries are present.

Use `archive:extract{destination = 'dir'}` to extract to
subdirectory `dir`.
]]
---@param options? table zip options
function pandoc.zip.Archive:extract(options) end

--[[
Returns the raw binary string representation of the archive.
]]
function pandoc.zip.Archive:bytestring() end

---@class pandoc.zip.Entry
---@field path string relative path, using `/` as separator
---@field modtime number modification time (seconds since unix epoch)

--[[
Get the uncompressed contents of a zip entry. If `password` is
given, then that password is used to decrypt the contents. An
error is throws if decrypting fails.
]]
---@param password? string password to decrypt the contents
---@return string
function pandoc.zip.Entry:contents(password) end


