

-- offset.lua
-- Copyright (C) 2020 by RStudio, PBC


function offset() 
  
  return {
  
    Link = function(el)
      local ref = offsetRef(el.target, projectOffset)
      if ref then
        el.target = ref
        return el
      end
    end,

    Image = function(el)
      local ref = offsetRef(el.src, projectOffset)
      if ref then
        el.src = ref
        return el
      end
    end

  }
 
end

function offsetRef(ref, projectOffset)
  if string.find(ref, "^/") then
    local projectOffset = param("project-offset")
    if projectOffset ~= nil then
      return pandoc.utils.stringify(projectOffset) .. ref
    end
  end
end

 