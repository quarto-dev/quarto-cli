Meta = function(m)
  if (pandoc.system.os == "mingw32") then
    -- IMPORTANT: This is only valid on windows
    assert(_G.convert_from_utf8, "Required function 'convert_from_utf8' is missing from global scope on Windows. Something may be wrong with 'init.lua'")
  else 
    assert(not _G.convert_from_utf8, "Function 'convert_from_utf8' is in global scope on non-Windows. Something may be wrong with 'init.lua'")
  end
  return m
end