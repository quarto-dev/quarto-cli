---@meta

--[[
The state shared by all readers and writers. It is used by pandoc to collect and pass information.
]]
---@class pandoc.CommonState
---@field input_files pandoc.List List of input files from command line
---@field output_file string|nil Output file from command line 
---@field log pandoc.List A list of log messages in reverse order 
---@field request_headers table<string,string>  Headers to add for HTTP requests; table with header names as keys and header contents as value 
---@field resource_path pandoc.List Path to search for resources like included images
---@field source_url string|nil Absolute URL or directory of first source file
---@field user_data_dir string|nil Directory to search for data files 
---@field trace boolean Whether tracing messages are issued 
---@field verbosity 'INFO'|'WARNING'|'ERROR' Verbosity level; one of `INFO`, `WARNING`, `ERROR` 

--[[
A pandoc log message. Objects have no fields, but can be converted to a string via `tostring`.
]]
---@class pandoc.LogMessage
pandoc.LogMessage = {}

