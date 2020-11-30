-- html-defaults.lua
-- Copyright (C) 2020 by RStudio, PBC

-- detect math
local math_detected = false
function DetectMath(s)
  math_detected = true
  return ""
end
InlineMath = DetectMath
DisplayMath = DetectMath

-- provide defaults based on tokens detected
function Doc(body, metadata, variables)
  if math_detected then
     return 'html-math-method: mathjax\n'
  else
     return ''
  end
end

-- ingore all other tokens
local meta = {}
meta.__index =
  function(_, key)
    return function() return "" end
  end
setmetatable(_G, meta)
