-- sections.lua
-- Copyright (C) 2020 by RStudio, PBC

function sections()
  return {
    Header = function(el)
      -- track current chapter
      if el.level == 1 then
        indexNextChapter()
      end
    end
  }
end