---@meta

---@module 'pandoc'
pandoc = {}

--[[
Runs command with arguments, passing it some input, and returns the output.
]]
---@param command string Program to run; the executable will be resolved using default system methods 
---@param args string[] List of arguments to pass to the program 
---@param input string Data which is piped into the program via stdin 
---@return string Output of command, i.e. data printed to stdout
function pandoc.pipe(command, args, input)
end


return pandoc

