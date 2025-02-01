---@meta

---@module 'pandoc.log'
pandoc.log = {}


--[[
Reports a ScriptingInfo message to pandoc's logging system.
]]
---@param message string the info message
function pandoc.log.info(message) end

--[[
Applies the function to the given arguments while preventing log messages from being added to the log.
The warnings and info messages reported during the function call are returned as the first return value, with the results of the function call following thereafter.
]]
---@param fn function the function to call
---@return table,any[] # List of log messages triggered during the function call, and any value returned by the function.
function pandoc.log.silence(fn) end

--[[
Reports a ScriptingWarning to pandoc's logging system. The warning will be printed to stderr unless logging verbosity has been set to ERROR.
]]
---@param message string the warning message
function pandoc.log.warn(message) end

return pandoc.log