---@meta

--[[
UTF-8 aware text manipulation functions, implemented in Haskell.
The module is made available as part of the `pandoc` module via
`pandoc.text`. The text module can also be loaded explicitly:

``` lua
-- uppercase all regular text in a document:
text = require 'text'
function Str (s)
  s.text = text.upper(s.text)
  return s
end
```
]]
---@module 'pandoc.text'
pandoc.text = {}

--[[
Returns a copy of a UTF-8 string, converted to lowercase.
]]
---@param s string String to transform
---@return string
function pandoc.text.lower(s) end


--[[
Returns a copy of a UTF-8 string, converted to uppercase.
]]
---@param s string String to transform
---@return string
function pandoc.text.upper(s) end

--[[
Returns a copy of a UTF-8 string, with characters reversed.
]]
---@param s string String to reverse
---@return string
function pandoc.text.reverse(s) end

--[[
Returns the length of a UTF-8 string
]]
---@param s string String to calculate the length of
---@return integer
function pandoc.text.len(s) end

--[[
Returns a substring of a UTF-8 string, using Lua's string indexing rules.
]]
---@param s string Original string
---@param first integer Index to begin at
---@param last? integer Index to end at (use negative index to count from the back)
---@return string
function pandoc.text.sub(s, first, last) end

--[[
Converts a string to UTF-8. The `encoding` parameter specifies the
encoding of the input string. On Windows, that parameter defaults
to the current ANSI code page; on other platforms the function
will try to use the file system's encoding.

See `toencoding` for more info on supported
encodings.
]]
---@param s string string to convert
---@param encoding string Encoding of the input string
---@return string
function pandoc.text.fromencoding(s, encoding) end

--[[
Converts a UTF-8 string to a different encoding. The `encoding`
parameter defaults to the current ANSI code page on Windows; on
other platforms it will try to guess the file system's encoding.

The set of known encodings is system dependent, but includes at
least `UTF-8`, `UTF-16BE`, `UTF-16LE`, `UTF-32BE`, and `UTF-32LE`.
Note that the default code page on Windows is available through
`CP0`.  
]]
---@param s string string to convert
---@param encoding string Encoding of the input string
---@return string
function pandoc.text.toencoding(s, encoding) end



return pandoc.text