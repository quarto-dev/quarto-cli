---@meta

---@class pandoc.types.Version
pandoc.types.Version = {}

---@alias version_specifier string|integer|integer[]|pandoc.types.Version

---@param version_specifier version_specifier
---@return pandoc.types.Version
function pandoc.types.Version(version_specifier) end


--[[
Raise an error message if the version is older than the expected version; 
does nothing if actual is equal to or newer than the expected version.  
]]
---@param actual version_specifier # Actual version specifier
---@param expected version_specifier # Expected version specifier
---@param error_message? string # (Optional) Error message template. The string is used as format string, with the expected and actual versions as arguments. Defaults to `"expected version %s or newer, got %s"`.
function pandoc.types.Version.must_be_at_least(actual, expected, error_message) end


