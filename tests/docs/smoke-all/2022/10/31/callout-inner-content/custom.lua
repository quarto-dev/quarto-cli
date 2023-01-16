Callout = function(callout)
  print("Yes, here")
end

Str = function(str)
  if string.match(str.text, "content") then
    return string.gsub(str.text, "content", "excellent content")
  end
end