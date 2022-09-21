---@meta

quarto.base64 = {}

--[[
Encode `str` into a base64 representation
]]
---@param str string String to encode
---@return string 
function quarto.base64.encode(str) end

--[[
Decode `b64str` into a string
]]
---@param b64str string Base64 encoded string
---@return string
function quarto.base64.decode(b64str) end