---@meta

quarto.brand = {}

--[[
Determine whether the current document has a brand of the specified `mode`.
]]
---@param mode string Mode string, `light` or `dark`
---@return boolean
function quarto.brand.has_mode(mode) end

--[[
Get a brand color in CSS format, for the brand of the specified `mode`.
]]
---@param mode string Mode string, `light` or `dark`
---@param name string Brand color name
---@return string
function quarto.brand.get_color_css(mode, name) end

--[[
Get a brand color in the output format, for the brand of the specified `mode`.
]]
---@param mode string Mode string, `light` or `dark`
---@param name string Brand color name
---@return string
function quarto.brand.get_color(mode, name) end

--[[
Get typography brand options, for the brand of the specified `mode` and element `name`.

The options table may have `family`, `size`, `weight`, `style`, `line-height`, `color`, 
`background-color`, `decoration` entries, depending on the element.
]]
---@param mode string Mode string, `light` or `dark`
---@param name string Typography element name
---@return table
function quarto.brand.get_typography(mode, name) end

--[[
Get a logo resource, for the brand of the specified `mode` and element `name`.

Currently the resulting table contains `light` and/or `dark` entries,
each a table with `path` and `alt`.

In the future, we could resolve fully based on `mode`.
]]
---@param mode string Mode string, `light` or `dark`
---@param name string String to be converted
---@return table
function quarto.brand.get_logo(mode, name) end
