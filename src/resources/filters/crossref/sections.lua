-- sections.lua
-- Copyright (C) 2020 by RStudio, PBC

function sections()
  
  return {
    Header = function(el)
      
      -- skip unnumbered
      if (el.classes:find("unnumbered")) then
        return el
      end
      
      -- cap levels at 7
      local level = math.min(el.level, 7)
      
      -- get the current level
      local currentLevel = currentSectionLevel()
      
      -- if this level is less than the current level
      -- then zero out subseqeunt levels
      if level < currentLevel then
        for i=level+1,#crossref.index.section do
          crossref.index.section[i] = 0
        end
      end
      
      -- increment the level counter
      crossref.index.section[level] = crossref.index.section[level] + 1
      
      -- if this is a chapter then notify the index
      if level == 1 then
        indexNextChapter()
      end

    end
  }
end

function currentSectionLevel()
  -- scan backwards for the first non-zero section level
  for i=#crossref.index.section,1,-1 do
    local section = crossref.index.section[i]
    if section ~= 0 then
      return i
    end
  end
  
  -- if we didn't find one then we are at zero (no sections yet)
  return 0
end

