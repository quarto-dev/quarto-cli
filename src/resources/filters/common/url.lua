-- url.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

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

function fullyUrlDecode(url)
  -- decode the url until it is fully decoded (not a single pass,
  -- but repeated until it decodes no further)
  result = urldecode(url)
  if result == url then
    return result
  else 
    return fullyUrlDecode(result)
  end
end
