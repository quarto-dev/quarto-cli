-- authors.lua
-- Copyright (C) 2020 by RStudio, PBC

-- global state
authorsState = {}

function authorsFilter()
  return {
    Meta = function(meta)
      return processAuthorMeta(meta)
    end
  }
end
