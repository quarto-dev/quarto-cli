-- observable.lua
-- Copyright (C) 2020 by RStudio, PBC

function observable()
  if (param("observable", false)) then
    return {
      CodeBlock = function(el)
        
      end,
      
      DisplayMath = function(el)
      
      end,
      
      RawBlock = function(el)
        
      end,
      
      Math = function(el)
        
      end,
      
      RawInline = function(el)
      
      end,
      
      Str = function(el)
        
      end
    }
  else 
    return {}
  end

end
