--- Loads `luacov.runner` and immediately starts it.
-- Useful for launching scripts from the command-line. Returns the `luacov.runner` module.
-- @class module
-- @name luacov
-- @usage lua -lluacov sometest.lua
local runner = require("luacov.runner")
runner.init()
return runner
