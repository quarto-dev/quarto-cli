
-- [import]
function import(script)
  local path = PANDOC_SCRIPT_FILE:match("(.*[/\\])")
  dofile(path .. script)
end
local sep = package.config:sub(1,1)
if sep == '\\' then
  import("../../filters/init/init.lua")  
end
-- [/import]





