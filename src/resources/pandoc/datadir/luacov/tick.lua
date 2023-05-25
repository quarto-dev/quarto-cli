
--- Load luacov using this if you want it to periodically
-- save the stats file. This is useful if your script is
-- a daemon (i.e., does not properly terminate).
-- @class module
-- @name luacov.tick
-- @see luacov.defaults.savestepsize
local runner = require("luacov.runner")
runner.tick = true
runner.init()
return {}
