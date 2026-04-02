---@meta

quarto.format.typst.css = {}

--[[
Wrap a string in double-quote characters.
]]
---@param s string String to quote
---@return string
function quarto.format.typst.css.quote(s) end

--[[
Strip leading and trailing single or double quotes from a string.
]]
---@param s string String to dequote
---@return string
function quarto.format.typst.css.dequote(s) end

--[[
Parse a CSS color string into an internal color representation.

Supports `#hex`, `rgb()`, `rgba()`, `var(--brand-*)`, and named CSS colors.
]]
---@param color string CSS color string
---@param warnings? pandoc.List Optional list to collect warnings
---@return table|nil Color object or nil if unparseable
function quarto.format.typst.css.parse_color(color, warnings) end

--[[
Parse a CSS opacity or alpha value.

Accepts fractions (0-1), percentages, or `"none"`.
]]
---@param opacity string|nil CSS opacity value
---@return table|nil Opacity object or nil
function quarto.format.typst.css.parse_opacity(opacity) end

--[[
Convert an internal color object to a Typst color expression string.
]]
---@param color table|nil Parsed color object
---@param opacity? table|nil Parsed opacity object
---@param warnings? pandoc.List Optional list to collect warnings
---@return string|nil Typst color expression
function quarto.format.typst.css.output_color(color, opacity, warnings) end

--[[
Return the CSS length unit suffix found at the end of a string.
]]
---@param s string String to check for length unit
---@return string|nil CSS unit suffix or nil
function quarto.format.typst.css.parse_length_unit(s) end

--[[
Parse a CSS length string into an internal length representation.
]]
---@param csslen string CSS length string (e.g. "12px", "1.5em")
---@param warnings? pandoc.List Optional list to collect warnings
---@return table|nil Length object {value, unit, csslen} or nil
function quarto.format.typst.css.parse_length(csslen, warnings) end

--[[
Convert an internal length object to a Typst length string.
]]
---@param length table Parsed length object
---@param warnings? pandoc.List Optional list to collect warnings
---@return string|nil Typst length string (e.g. "12pt", "1em")
function quarto.format.typst.css.output_length(length, warnings) end

--[[
Parse and convert a CSS length string directly to a Typst length string.

Combines `parse_length` and `output_length`.
]]
---@param csslen string CSS length string
---@param warnings? pandoc.List Optional list to collect warnings
---@return string|nil Typst length string
function quarto.format.typst.css.translate_length(csslen, warnings) end

--[[
Repeatedly call a callback function on substrings of a string.
]]
---@param s string Input string to process
---@param limit number Maximum number of iterations
---@param callback fun(s: string, start: number): number Callback returning next start position
function quarto.format.typst.css.parse_multiple(s, limit, callback) end

--[[
Expand a 1-4 element CSS shorthand array into a `{top, right, bottom, left}` table.
]]
---@param items table Array of 1-4 values
---@param context string Context description for warnings
---@param warnings? pandoc.List Optional list to collect warnings
---@return table {top, right, bottom, left}
function quarto.format.typst.css.expand_side_shorthand(items, context, warnings) end

--[[
Parse a CSS `border` shorthand string into Typst-ready components.
]]
---@param v string CSS border shorthand (e.g. "1px solid red")
---@param warnings? pandoc.List Optional list to collect warnings
---@return table {thickness: string|nil, dash: string|nil, paint: string|nil}
function quarto.format.typst.css.translate_border(v, warnings) end

--[[
Translate a CSS border-width keyword or length to a Typst length string.

Returns `"delete"` for zero-width borders.
]]
---@param v string CSS border-width value
---@param warnings? pandoc.List Optional list to collect warnings
---@return string|nil Typst length or "delete"
function quarto.format.typst.css.translate_border_width(v, warnings) end

--[[
Translate a CSS border-style keyword to a Typst dash string.

Returns `"delete"` for `"none"`.
]]
---@param v string CSS border-style keyword
---@param warnings? pandoc.List Optional list to collect warnings
---@return string|nil Typst dash string or "delete"
function quarto.format.typst.css.translate_border_style(v, warnings) end

--[[
Translate a CSS color string to a Typst color expression.
]]
---@param v string CSS color string
---@param warnings? pandoc.List Optional list to collect warnings
---@return string|nil Typst color expression
function quarto.format.typst.css.translate_border_color(v, warnings) end

--[[
Translate a CSS font-weight keyword or numeric string to a Typst font weight.
]]
---@param w string|nil CSS font-weight value
---@param warnings? pandoc.List Optional list to collect warnings
---@return string|number|nil Typst font weight (name or integer)
function quarto.format.typst.css.translate_font_weight(w, warnings) end

--[[
Convert a comma-separated CSS font-family list to a Typst array literal.
]]
---@param sl string|nil CSS font-family list
---@return string Typst array literal (e.g. `("Arial", "sans-serif",)`)
function quarto.format.typst.css.translate_font_family_list(sl) end

--[[
Read one border-width token from a string at a given position.
]]
---@param s string Input string
---@param start number Start position
---@param warnings? pandoc.List Optional list to collect warnings
---@return string|nil Typst thickness string
---@return number Next start position
function quarto.format.typst.css.consume_width(s, start, warnings) end

--[[
Read one border-style token from a string at a given position.
]]
---@param s string Input string
---@param start number Start position
---@param warnings? pandoc.List Optional list to collect warnings
---@return string|nil Typst dash string
---@return number Next start position
function quarto.format.typst.css.consume_style(s, start, warnings) end

--[[
Read one color token from a string at a given position.

Handles functional forms like `rgb(...)` and `rgba(...)`.
]]
---@param s string Input string
---@param start number Start position
---@param warnings? pandoc.List Optional list to collect warnings
---@return string|nil Typst color string
---@return number Next start position
function quarto.format.typst.css.consume_color(s, start, warnings) end
