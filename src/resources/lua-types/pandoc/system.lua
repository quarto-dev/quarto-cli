
---@meta

---@module 'pandoc.system'
pandoc.system = {}

--[[
The machine architecture on which the program is running.
]]
pandoc.system.arch = 'x86_64'

--[[
The operating system on which the program is running.
]]
pandoc.system.os = 'darwin'


--[[
Retrieve the entire environment as a string-indexed table. 

Returns:

-   A table mapping environment variables names to their string value 
]]
---@return table<string,string> 
function pandoc.system.environment() end

--[[
Obtain the current working directory as an absolute path.

Returns:

-   The current working directory
]]
---@return string
function pandoc.system.get_working_directory() end

--[[
List the contents of a directory. 
]]
---@param directory? string Path of the directory whose contents should be listed. Defaults to `.`
---@return table A table of all entries in `directory` without the special entries `.` and `..`.
function pandoc.system.list_directory(directory) end

--[[
Create a new directory which is initially empty, or as near to
empty as the operating system allows. The function throws an
error if the directory cannot be created, e.g., if the parent
directory does not exist or if a directory of the same name is
already present.

If the optional second parameter is provided and truthy, then all
directories, including parent directories, are created as
necessary.
]]
---@param dirname string Name of the new directory
---@param create_parent? boolean Create parent directories if necessary
function pandoc.system.make_directory(dirname, create_parent) end

--[[
Remove an existing, empty directory. If `recursive` is given,
then delete the directory and its contents recursively.
]]
---@param dirname string Name of the directory to delete
---@param recursive? boolean Delete content recursively
function pandoc.system.remove_directory(dirname, recursive) end

--[[
-- Run an action within a custom environment. Only the environment
-- variables given by `environment` will be set, when `callback` is
-- called. The original environment is restored after this function
-- finishes, even if an error occurs while running the callback
-- action.
]]
---@param environment table<string,string> Environment variables and their values to be set beforerunning `callback`
---@param callback fun() : unknown Action to execute in the custom environment
---@return unknown # The result(s) of the call to `callback`
function pandoc.system.with_environment(environment, callback) end

--[[
Create and use a temporary directory inside the the system's canonical temporary directory.
The directory is deleted after the callback returns.
]]
---@param templ string Directory name template
---@param callback fun(x: string) : unknown Function which takes the name of the temporary directory as ts first argument.
---@return unknown # The result(s) of the call to `callback`
function pandoc.system.with_temporary_directory(templ, callback) end


--[[
Create and use a temporary directory inside the given directory.
The directory is deleted after the callback returns.
]]
---@param parent_dir string Parent directory to create the directory in. If this parameter is omitted, the system's canonical temporary directory is used.
---@param templ string Directory name template
---@param callback fun(x: string) : unknown Function which takes the name of the temporary directory as ts first argument.
---@return unknown # The result(s) of the call to `callback`
function pandoc.system.with_temporary_directory(parent_dir, templ, callback) end

--[[
Run an action within a different directory. This function will
change the working directory to `directory`, execute `callback`,
then switch back to the original working directory, even if an
error occurs while running the callback action.
]]
---@param directory string Directory in which the given `callback` should be executed
---@param callback fun() : unknown Action to execute in the given directory.
---@return unknown # The result(s) of the call to `callback`
function pandoc.system.with_working_directory(directory, callback) end

return pandoc.system