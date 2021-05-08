-- sections.lua
-- Copyright (C) 2020 by RStudio, PBC

function sections()
  
  return {
    Header = function(el)
      
      -- index the heading
      indexAddHeading(el.attr.identifier)

      -- skip unnumbered
      if (el.classes:find("unnumbered")) then
        return el
      end
      
      -- cap levels at 7
      local level = math.min(el.level, 7)
      
      -- get the current level
      local currentLevel = currentSectionLevel()
      
      -- if this level is less than the current level
      -- then set subsequent levels to their offset
      if level < currentLevel then
        for i=level+1,#crossref.index.section do
          crossref.index.section[i] = crossref.index.sectionOffsets[i]
        end
      end
      
      -- increment the level counter
      crossref.index.section[level] = crossref.index.section[level] + 1
      
      -- if this is a chapter then notify the index (will be used to 
      -- reset type-counters if we are in "chapters" mode)
      if level == 1 then
        indexNextChapter()
      end
      
      -- if this has a section identifier then index it
      if refType(el.attr.identifier) == "sec" then
        local order = indexNextOrder("sec")
        indexAddEntry(el.attr.identifier, nil, order, el.content)
      end
      
      -- number the section if required
      if (numberSections()) then
        local section = sectionNumber(crossref.index.section, level)
        el.attr.attributes["number"] = section
        el.content:insert(1, pandoc.Space())
        el.content:insert(1, pandoc.Span(
          stringToInlines(section),
          pandoc.Attr("", { "header-section-number"})
        ))
      end
      
      -- return 
      return el
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

function numberSections()
  return (formatRequiresSectionNumber() and param("number-sections", false)) or
          crossrefOption("chapters-alpha", false)
end

function formatRequiresSectionNumber()
  return not isLatexOutput() and not isHtmlOutput() and not isDocxOutput()
end

