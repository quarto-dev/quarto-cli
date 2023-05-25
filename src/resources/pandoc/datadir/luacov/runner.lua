---------------------------------------------------
-- Statistics collecting module.
-- Calling the module table is a shortcut to calling the `init` function.
-- @class module
-- @name luacov.runner

local runner = {}
--- LuaCov version in `MAJOR.MINOR.PATCH` format.
runner.version = "0.15.0"

local stats = require("luacov.stats")
local util = require("luacov.util")
runner.defaults = require("luacov.defaults")

local debug = require("debug")
local raw_os_exit = os.exit

local new_anchor = newproxy or function() return {} end -- luacheck: compat

-- Returns an anchor that runs fn when collected.
local function on_exit_wrap(fn)
   local anchor = new_anchor()
   debug.setmetatable(anchor, {__gc = fn})
   return anchor
end

runner.data = {}
runner.paused = true
runner.initialized = false
runner.tick = false

-- Checks if a string matches at least one of patterns.
-- @param patterns array of patterns or nil
-- @param str string to match
-- @param on_empty return value in case of empty pattern array
local function match_any(patterns, str, on_empty)
   if not patterns or not patterns[1] then
      return on_empty
   end

   for _, pattern in ipairs(patterns) do
      if string.match(str, pattern) then
         return true
      end
   end

   return false
end

--------------------------------------------------
-- Uses LuaCov's configuration to check if a file is included for
-- coverage data collection.
-- @param filename name of the file.
-- @return true if file is included, false otherwise.
function runner.file_included(filename)
   -- Normalize file names before using patterns.
   filename = string.gsub(filename, "\\", "/")
   filename = string.gsub(filename, "%.lua$", "")

   -- If include list is empty, everything is included by default.
   -- If exclude list is empty, nothing is excluded by default.
   return match_any(runner.configuration.include, filename, true) and
      not match_any(runner.configuration.exclude, filename, false)
end

--------------------------------------------------
-- Adds stats to an existing file stats table.
-- @param old_stats stats to be updated.
-- @param extra_stats another stats table, will be broken during update.
function runner.update_stats(old_stats, extra_stats)
   old_stats.max = math.max(old_stats.max, extra_stats.max)

   -- Remove string keys so that they do not appear when iterating
   -- over 'extra_stats'.
   extra_stats.max = nil
   extra_stats.max_hits = nil

   for line_nr, run_nr in pairs(extra_stats) do
      old_stats[line_nr] = (old_stats[line_nr] or 0) + run_nr
      old_stats.max_hits = math.max(old_stats.max_hits, old_stats[line_nr])
   end
end

-- Adds accumulated stats to existing stats file or writes a new one, then resets data.
function runner.save_stats()
   local loaded = stats.load(runner.configuration.statsfile) or {}

   for name, file_data in pairs(runner.data) do
      if loaded[name] then
         runner.update_stats(loaded[name], file_data)
      else
         loaded[name] = file_data
      end
   end

   stats.save(runner.configuration.statsfile, loaded)
   runner.data = {}
end

local cluacov_ok = pcall(require, "cluacov.version")

--------------------------------------------------
-- Debug hook set by LuaCov.
-- Acknowledges that a line is executed, but does nothing
-- if called manually before coverage gathering is started.
-- @param _ event type, should always be "line".
-- @param line_nr line number.
-- @param[opt] level passed to debug.getinfo to get name of processed file,
-- 2 by default. Increase it if this function is called manually
-- from another debug hook.
-- @usage
-- local function custom_hook(_, line)
--    runner.debug_hook(_, line, 3)
--    extra_processing(line)
-- end
-- @function debug_hook
runner.debug_hook = require(cluacov_ok and "cluacov.hook" or "luacov.hook").new(runner)

------------------------------------------------------
-- Runs the reporter specified in configuration.
-- @param[opt] configuration if string, filename of config file (used to call `load_config`).
-- If table then config table (see file `luacov.default.lua` for an example).
-- If `configuration.reporter` is not set, runs the default reporter;
-- otherwise, it must be a module name in 'luacov.reporter' namespace.
-- The module must contain 'report' function, which is called without arguments.
function runner.run_report(configuration)
   configuration = runner.load_config(configuration)
   local reporter = "luacov.reporter"

   if configuration.reporter then
      reporter = reporter .. "." .. configuration.reporter
   end

   require(reporter).report()
end

local on_exit_run_once = false

local function on_exit()
   -- Lua >= 5.2 could call __gc when user call os.exit
   -- so this method could be called twice
   if on_exit_run_once then return end
   on_exit_run_once = true
   -- disable hooks before aggregating stats
   debug.sethook(nil)
   runner.save_stats()

   if runner.configuration.runreport then
      runner.run_report(runner.configuration)
   end
end

local dir_sep = package.config:sub(1, 1)
local wildcard_expansion = "[^/]+"

if not dir_sep:find("[/\\]") then
   dir_sep = "/"
end

local function escape_module_punctuation(ch)
   if ch == "." then
      return "/"
   elseif ch == "*" then
      return wildcard_expansion
   else
      return "%" .. ch
   end
end

local function reversed_module_name_parts(name)
   local parts = {}

   for part in name:gmatch("[^%.]+") do
      table.insert(parts, 1, part)
   end

   return parts
end

-- This function is used for sorting module names.
-- More specific names should come first.
-- E.g. rule for 'foo.bar' should override rule for 'foo.*',
-- rule for 'foo.*' should override rule for 'foo.*.*',
-- and rule for 'a.b' should override rule for 'b'.
-- To be more precise, because names become patterns that are matched
-- from the end, the name that has the first (from the end) literal part
-- (and the corresponding part for the other name is not literal)
-- is considered more specific.
local function compare_names(name1, name2)
   local parts1 = reversed_module_name_parts(name1)
   local parts2 = reversed_module_name_parts(name2)

   for i = 1, math.max(#parts1, #parts2) do
      if not parts1[i] then return false end
      if not parts2[i] then return true end

      local is_literal1 = not parts1[i]:find("%*")
      local is_literal2 = not parts2[i]:find("%*")

      if is_literal1 ~= is_literal2 then
         return is_literal1
      end
   end

   -- Names are at the same level of specificness,
   -- fall back to lexicographical comparison.
   return name1 < name2
end

-- Sets runner.modules using runner.configuration.modules.
-- Produces arrays of module patterns and filenames and sets
-- them as runner.modules.patterns and runner.modules.filenames.
-- Appends these patterns to the include list.
local function acknowledge_modules()
   runner.modules = {patterns = {}, filenames = {}}

   if not runner.configuration.modules then
      return
   end

   if not runner.configuration.include then
      runner.configuration.include = {}
   end

   local names = {}

   for name in pairs(runner.configuration.modules) do
      table.insert(names, name)
   end

   table.sort(names, compare_names)

   for _, name in ipairs(names) do
      local pattern = name:gsub("%p", escape_module_punctuation) .. "$"
      local filename = runner.configuration.modules[name]:gsub("[/\\]", dir_sep)
      table.insert(runner.modules.patterns, pattern)
      table.insert(runner.configuration.include, pattern)
      table.insert(runner.modules.filenames, filename)

      if filename:match("init%.lua$") then
         pattern = pattern:gsub("$$", "/init$")
         table.insert(runner.modules.patterns, pattern)
         table.insert(runner.configuration.include, pattern)
         table.insert(runner.modules.filenames, filename)
      end
   end
end

--------------------------------------------------
-- Returns real name for a source file name
-- using `luacov.defaults.modules` option.
-- @param filename name of the file.
function runner.real_name(filename)
   local orig_filename = filename
   -- Normalize file names before using patterns.
   filename = filename:gsub("\\", "/"):gsub("%.lua$", "")

   for i, pattern in ipairs(runner.modules.patterns) do
      local match = filename:match(pattern)

      if match then
         local new_filename = runner.modules.filenames[i]

         if pattern:find(wildcard_expansion, 1, true) then
            -- Given a prefix directory, join it
            -- with matched part of source file name.
            if not new_filename:match("/$") then
               new_filename = new_filename .. "/"
            end

            new_filename = new_filename .. match .. ".lua"
         end

         -- Switch slashes back to native.
         return (new_filename:gsub("^%.[/\\]", ""):gsub("[/\\]", dir_sep))
      end
   end

   return orig_filename
end

-- Always exclude luacov's own files.
local luacov_excludes = {
   "luacov$",
   "luacov/hook$",
   "luacov/reporter$",
   "luacov/reporter/default$",
   "luacov/defaults$",
   "luacov/runner$",
   "luacov/stats$",
   "luacov/tick$",
   "luacov/util$",
   "cluacov/version$"
}

local function is_absolute(path)
   if path:sub(1, 1) == dir_sep or path:sub(1, 1) == "/" then
      return true
   end

   if dir_sep == "\\" and path:find("^%a:") then
      return true
   end

   return false
end

local function get_cur_dir()
   local pwd_cmd = dir_sep == "\\" and "cd 2>nul" or "pwd 2>/dev/null"
   local handler = io.popen(pwd_cmd, "r")
   local cur_dir = handler:read()
   handler:close()
   cur_dir = cur_dir:gsub("\r?\n$", "")

   if cur_dir:sub(-1) ~= dir_sep and cur_dir:sub(-1) ~= "/" then
      cur_dir = cur_dir .. dir_sep
   end

   return cur_dir
end

-- Sets configuration. If some options are missing, default values are used instead.
local function set_config(configuration)
   runner.configuration = {}

   for option, default_value in pairs(runner.defaults) do
      runner.configuration[option] = default_value
   end

   for option, value in pairs(configuration) do
      runner.configuration[option] = value
   end

   -- Program using LuaCov may change directory during its execution.
   -- Convert path options to absolute paths to use correct paths anyway.
   local cur_dir

   for _, option in ipairs({"statsfile", "reportfile"}) do
      local path = runner.configuration[option]

      if not is_absolute(path) then
         cur_dir = cur_dir or get_cur_dir()
         runner.configuration[option] = cur_dir .. path
      end
   end

   acknowledge_modules()

   for _, patt in ipairs(luacov_excludes) do
      table.insert(runner.configuration.exclude, patt)
   end

   runner.tick = runner.tick or runner.configuration.tick
end

local function load_config_file(name, is_default)
   local conf = setmetatable({}, {__index = _G})

   local ok, ret, error_msg = util.load_config(name, conf)

   if ok then
      if type(ret) == "table" then
         for key, value in pairs(ret) do
            if conf[key] == nil then
               conf[key] = value
            end
         end
      end

      return conf
   end

   local error_type = ret

   if error_type == "read" and is_default then
      return nil
   end

   io.stderr:write(("Error: couldn't %s config file %s: %s\n"):format(error_type, name, error_msg))
   raw_os_exit(1)
end

local default_config_file = ".luacov"

------------------------------------------------------
-- Loads a valid configuration.
-- @param[opt] configuration user provided config (config-table or filename)
-- @return existing configuration if already set, otherwise loads a new
-- config from the provided data or the defaults.
-- When loading a new config, if some options are missing, default values
-- from `luacov.defaults` are used instead.
function runner.load_config(configuration)
   if not runner.configuration then
      if not configuration then
         -- Nothing provided, load from default location if possible.
         set_config(load_config_file(default_config_file, true) or runner.defaults)
      elseif type(configuration) == "string" then
         set_config(load_config_file(configuration))
      elseif type(configuration) == "table" then
         set_config(configuration)
      else
         error("Expected filename, config table or nil. Got " .. type(configuration))
      end
   end

   return runner.configuration
end

--------------------------------------------------
-- Pauses saving data collected by LuaCov's runner.
-- Allows other processes to write to the same stats file.
-- Data is still collected during pause.
function runner.pause()
   runner.paused = true
end

--------------------------------------------------
-- Resumes saving data collected by LuaCov's runner.
function runner.resume()
   runner.paused = false
end

local hook_per_thread

-- Determines whether debug hooks are separate for each thread.
local function has_hook_per_thread()
   if hook_per_thread == nil then
      local old_hook, old_mask, old_count = debug.gethook()
      local noop = function() end
      debug.sethook(noop, "l")
      local thread_hook = coroutine.wrap(function() return debug.gethook() end)()
      hook_per_thread = thread_hook ~= noop
      debug.sethook(old_hook, old_mask, old_count)
   end

   return hook_per_thread
end

--------------------------------------------------
-- Wraps a function, enabling coverage gathering in it explicitly.
-- LuaCov gathers coverage using a debug hook, and patches coroutine
-- library to set it on created threads when under standard Lua, where each
-- coroutine has its own hook. If a coroutine is created using Lua C API
-- or before the monkey-patching, this wrapper should be applied to the
-- main function of the coroutine. Under LuaJIT this function is redundant,
-- as there is only one, global debug hook.
-- @param f a function
-- @return a function that enables coverage gathering and calls the original function.
-- @usage
-- local coro = coroutine.create(runner.with_luacov(func))
function runner.with_luacov(f)
   return function(...)
      if has_hook_per_thread() then
         debug.sethook(runner.debug_hook, "l")
      end

      return f(...)
   end
end

--------------------------------------------------
-- Initializes LuaCov runner to start collecting data.
-- @param[opt] configuration if string, filename of config file (used to call `load_config`).
-- If table then config table (see file `luacov.default.lua` for an example)
function runner.init(configuration)
   runner.configuration = runner.load_config(configuration)

   -- metatable trick on filehandle won't work if Lua exits through
   -- os.exit() hence wrap that with exit code as well
   os.exit = function(...) -- luacheck: no global
      on_exit()
      raw_os_exit(...)
   end

   debug.sethook(runner.debug_hook, "l")

   if has_hook_per_thread() then
      -- debug must be set for each coroutine separately
      -- hence wrap coroutine function to set the hook there
      -- as well
      local rawcoroutinecreate = coroutine.create
      coroutine.create = function(...) -- luacheck: no global
         local co = rawcoroutinecreate(...)
         debug.sethook(co, runner.debug_hook, "l")
         return co
      end

      -- Version of assert which handles non-string errors properly.
      local function safeassert(ok, ...)
         if ok then
            return ...
         else
            error(..., 0)
         end
      end

      coroutine.wrap = function(...) -- luacheck: no global
         local co = rawcoroutinecreate(...)
         debug.sethook(co, runner.debug_hook, "l")
         return function(...)
            return safeassert(coroutine.resume(co, ...))
         end
      end
   end

   if not runner.tick then
      runner.on_exit_trick = on_exit_wrap(on_exit)
   end

   runner.initialized = true
   runner.paused = false
end

--------------------------------------------------
-- Shuts down LuaCov's runner.
-- This should only be called from daemon processes or sandboxes which have
-- disabled os.exit and other hooks that are used to determine shutdown.
function runner.shutdown()
   on_exit()
end

-- Gets the sourcefilename from a function.
-- @param func function to lookup.
-- @return sourcefilename or nil when not found.
local function getsourcefile(func)
   assert(type(func) == "function")
   local d = debug.getinfo(func).source
   if d and d:sub(1, 1) == "@" then
      return d:sub(2)
   end
end

-- Looks for a function inside a table.
-- @param searched set of already checked tables.
local function findfunction(t, searched)
   if searched[t] then
      return
   end

   searched[t] = true

   for _, v in pairs(t) do
      if type(v) == "function" then
         return v
      elseif type(v) == "table" then
         local func = findfunction(v, searched)
         if func then return func end
      end
   end
end

-- Gets source filename from a file name, module name, function or table.
-- @param name string;   filename,
--             string;   modulename as passed to require(),
--             function; where containing file is looked up,
--             table;    module table where containing file is looked up
-- @raise error message if could not find source filename.
-- @return source filename.
local function getfilename(name)
   if type(name) == "function" then
      local sourcefile = getsourcefile(name)

      if not sourcefile then
         error("Could not infer source filename")
      end

      return sourcefile
   elseif type(name) == "table" then
      local func = findfunction(name, {})

      if not func then
         error("Could not find a function within " .. tostring(name))
      end

      return getfilename(func)
   else
      if type(name) ~= "string" then
         error("Bad argument: " .. tostring(name))
      end

      if util.file_exists(name) then
         return name
      end

      local success, result = pcall(require, name)

      if not success then
         error("Module/file '" .. name .. "' was not found")
      end

      if type(result) ~= "table" and type(result) ~= "function" then
         error("Module '" .. name .. "' did not return a result to lookup its file name")
      end

      return getfilename(result)
   end
end

-- Escapes a filename.
-- Escapes magic pattern characters, removes .lua extension
-- and replaces dir seps by '/'.
local function escapefilename(name)
   return name:gsub("%.lua$", ""):gsub("[%%%^%$%.%(%)%[%]%+%*%-%?]","%%%0"):gsub("\\", "/")
end

local function addfiletolist(name, list)
  local f = "^"..escapefilename(getfilename(name)).."$"
  table.insert(list, f)
  return f
end

local function addtreetolist(name, level, list)
   local f = escapefilename(getfilename(name))

   if level or f:match("/init$") then
      -- chop the last backslash and everything after it
      f = f:match("^(.*)/") or f
   end

   local t = "^"..f.."/"   -- the tree behind the file
   f = "^"..f.."$"         -- the file
   table.insert(list, f)
   table.insert(list, t)
   return f, t
end

-- Returns a pcall result, with the initial 'true' value removed
-- and 'false' replaced with nil.
local function checkresult(ok, ...)
   if ok then
      return ... -- success, strip 'true' value
   else
      return nil, ... -- failure; nil + error
   end
end

-------------------------------------------------------------------
-- Adds a file to the exclude list (see `luacov.defaults`).
-- If passed a function, then through debuginfo the source filename is collected. In case of a table
-- it will recursively search the table for a function, which is then resolved to a filename through debuginfo.
-- If the parameter is a string, it will first check if a file by that name exists. If it doesn't exist
-- it will call `require(name)` to load a module by that name, and the result of require (function or
-- table expected) is used as described above to get the sourcefile.
-- @param name
-- * string;   literal filename,
-- * string;   modulename as passed to require(),
-- * function; where containing file is looked up,
-- * table;    module table where containing file is looked up
-- @return the pattern as added to the list, or nil + error
function runner.excludefile(name)
  return checkresult(pcall(addfiletolist, name, runner.configuration.exclude))
end
-------------------------------------------------------------------
-- Adds a file to the include list (see `luacov.defaults`).
-- @param name see `excludefile`
-- @return the pattern as added to the list, or nil + error
function runner.includefile(name)
  return checkresult(pcall(addfiletolist, name, runner.configuration.include))
end
-------------------------------------------------------------------
-- Adds a tree to the exclude list (see `luacov.defaults`).
-- If `name = 'luacov'` and `level = nil` then
-- module 'luacov' (luacov.lua) and the tree 'luacov' (containing `luacov/runner.lua` etc.) is excluded.
-- If `name = 'pl.path'` and `level = true` then
-- module 'pl' (pl.lua) and the tree 'pl' (containing `pl/path.lua` etc.) is excluded.
-- NOTE: in case of an 'init.lua' file, the 'level' parameter will always be set
-- @param name see `excludefile`
-- @param level if truthy then one level up is added, including the tree
-- @return the 2 patterns as added to the list (file and tree), or nil + error
function runner.excludetree(name, level)
  return checkresult(pcall(addtreetolist, name, level, runner.configuration.exclude))
end
-------------------------------------------------------------------
-- Adds a tree to the include list (see `luacov.defaults`).
-- @param name see `excludefile`
-- @param level see `includetree`
-- @return the 2 patterns as added to the list (file and tree), or nil + error
function runner.includetree(name, level)
  return checkresult(pcall(addtreetolist, name, level, runner.configuration.include))
end


return setmetatable(runner, {__call = function(_, configfile) runner.init(configfile) end})
