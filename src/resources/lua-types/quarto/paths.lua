---@meta

quarto.paths = {}

--[[
Returns the path to the `Rscript` file that Quarto itself would use in its knitr engine.
]]
---@return string # Path to `Rscript` file
function quarto.paths.rscript() end

--[[
Returns the path to the `TinyTeX` bin directory that `quarto install tinytex` installed to, or nil if not found.
]]
---@return string|nil # Path to `TinyTeX` bin directory
function quarto.paths.tinytex_bin_dir() end
