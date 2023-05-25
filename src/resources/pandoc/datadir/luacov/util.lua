---------------------------------------------------
-- Utility module.
-- @class module
-- @name luacov.util
local util = {}

--- Removes a prefix from a string if it's present.
-- @param str a string.
-- @param prefix a prefix string.
-- @return original string if does not start with prefix
-- or string without prefix.
function util.unprefix(str, prefix)
   if str:sub(1, #prefix) == prefix then
      return str:sub(#prefix + 1)
   else
      return str
   end
end

-- Returns contents of a file or nil + error message.
local function read_file(name)
   local f, open_err = io.open(name, "rb")

   if not f then
      return nil, util.unprefix(open_err, name .. ": ")
   end

   local contents, read_err = f:read("*a")
   f:close()

   if contents then
      return contents
   else
      return nil, read_err
   end
end

--- Loads a string.
-- @param str a string.
-- @param[opt] env environment table.
-- @param[opt] chunkname chunk name.
function util.load_string(str, env, chunkname)
   if _VERSION:find("5%.1") then
      local func, err = loadstring(str, chunkname) -- luacheck: compat

      if not func then
         return nil, err
      end

      if env then
         setfenv(func, env) -- luacheck: compat
      end

      return func
   else
      return load(str, chunkname, "bt", env or _ENV) -- luacheck: compat
   end
end

--- Load a config file.
-- Reads, loads and runs a Lua file in an environment.
-- @param name file name.
-- @param env environment table.
-- @return true and the first return value of config on success,
-- nil + error type + error message on failure, where error type
-- can be "read", "load" or "run".
function util.load_config(name, env)
   local src, read_err = read_file(name)

   if not src then
      return nil, "read", read_err
   end

   local func, load_err = util.load_string(src, env, "@config")

   if not func then
      return nil, "load", "line " .. util.unprefix(load_err, "config:")
   end

   local ok, ret = pcall(func)

   if not ok then
      return nil, "run", "line " .. util.unprefix(ret, "config:")
   end

   return true, ret
end

--- Checks if a file exists.
-- @param name file name.
-- @return true if file can be opened, false otherwise.
function util.file_exists(name)
   local f = io.open(name)

   if f then
      f:close()
      return true
   else
      return false
   end
end

return util
