---@meta

quarto.log = {}

--[[
Set the log level, which controls which of `quarto.log.error()`, `quarto.log.warning()`, `quarto.log.info()` will generate output when called.

* `-2` : (or less) suppress all logging (apart from `quarto.log.temp()`)
* `-1` : output only error messages
* `0` : output error and warning messages
* `1` : output error, warning and info messages
* `2` : output error, warning, info and debug messages
* `3` : (or more) output error, warning, info, debug and trace messages

The initial log level is `0`, unless the following pandoc command-line options are specified:

* `--trace` : `3` if `--verbose` is also specified; otherwise `2`
* `--verbose` : `1`
* `--quiet` : `-1`
]]
---@param level integer Log level
function quarto.log.setloglevel(level) end

--[[
Current log level (call `quarto.log.setloglevel()` to change the level)
]]
quarto.log.loglevel = 0



--[[
Returns whatever [`pandoc.utils.type()`](https://pandoc.org/lua-filters.html#pandoc.utils.type) returns, modified as follows:

* Spaces are replaced with periods, e.g., `pandoc Row` becomes `pandoc.Row`
* `Inline` and `Block` are replaced with the corresponding `tag` value, e.g. `Emph` or `Table`
]]
---@param value any Value to examine
---@return string
function quarto.log.type(value) end


--[[
Like `pairs()` but with sorted keys. Keys are converted to strings and sorted
using `table.sort(keys, comp)` so by default they're visited in alphabetical
order.
]]
---@param list table List to enumerate
---@param comp? function Optional comparison function
---@return function Iterator function
function quarto.log.spairs(list, comp) end

--[[
Returns a pandoc-aware string representation of `value`, which can be an arbitrary lua object.

The returned string is a single line if not longer than `maxlen` (default `70`), and is otherwise multiple lines (with two character indentation). The string is not terminated with a newline.

Map keys are sorted alphabetically in order to ensure that output is repeatable.
]]
---@param value any Value to dump
---@param maxlen? integer Maximum length of lines
---@return string # Dumped contents of `value`
function quarto.log.dump(value, maxlen) end

--[[
Pass each argument to `logging.dump()` and output the results to `stderr`, separated by single spaces and terminated (if necessary) with a newline.

Note: Only `table` and `userdata` arguments are passed to
`logging.dump()`. Other arguments are passed to the built-in `tostring()`
function. This is partly an optimization and partly to prevent string arguments
from being quoted.
]]
function quarto.log.output(...) end


--[[
If the log level is >= `-1`, calls `quarto.log.output()` with `(E)` and the supplied arguments.
]]
function quarto.log.error(...) end

--[[
If the log level is >= `0`, calls `quarto.log.output()` with `(W)` and the supplied arguments.
]]
function quarto.log.warning(...) end

--[[
 If the log level is >= `1`, calls `quarto.log.output()` with `(I)` and the supplied arguments.
]]
function quarto.log.info(...) end

--[[
If the log level is >= `2`, calls `quarto.log.output()` with `(D)` and the supplied arguments.
]]
function quarto.log.debug(...) end

--[[
If the log level is >= `3`, calls `quarto.log.output()` with `(T)` and the supplied arguments.
]]
function quarto.log.trace(...) end

--[[
Unconditionally calls `quarto.log.output()` with `(#)` and the supplied arguments.
]]
function quarto.log.temp(...) end





