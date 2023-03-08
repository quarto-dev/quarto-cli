-- url.lua
-- Copyright (C) 2020-2023 Posit, PBC

function urldecode(url)
  if url == nil then
  return
  end
    url = url:gsub("+", " ")
    url = url:gsub("%%(%x%x)", function(x)
      return string.char(tonumber(x, 16))
    end)
  return url
end


