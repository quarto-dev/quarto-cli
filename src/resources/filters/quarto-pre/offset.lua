

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
  local projOffset = projectOffset()
  if projOffset ~= nil and string.find(ref, "^/") then
    return projOffset .. ref
  end
end

function projectOffset()
  local projOffset = param("project-offset")
  if projOffset ~= nil then
    return pandoc.utils.stringify(projOffset)
  else
    return nil
  end
end

 