-- sections.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

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
        indexNextChapter(crossref.index.section[level], currentFileMetadataState().appendix)
      end
      
      -- if this has a section identifier then index it
      if refType(el.attr.identifier) == "sec" then
        local order = indexNextOrder("sec")
        indexAddEntry(el.attr.identifier, nil, order, el.content, currentFileMetadataState().appendix)
      end

      -- if the number sections option is enabled then emulate pandoc numbering
      local section = sectionNumber(crossref.index.section, level)
      if not _quarto.format.isEpubOutput() and numberSectionsOptionEnabled() and level <= numberDepth() then
        el.attr.attributes["number"] = section
      end
      
      -- number the section if required
      if (numberSections() and level <= numberDepth()) then
        local appendix = (level == 1) and currentFileMetadataState().appendix
        if appendix then
          el.content:insert(1, pandoc.Space())
          tprepend(el.content, crossrefOption("appendix-delim", stringToInlines(" —")))
        elseif level == 1 and not _quarto.format.isHtmlOutput() then
          el.content:insert(1, pandoc.Str(". "))
        else
          el.content:insert(1, pandoc.Space())
        end

        if _quarto.format.isHtmlOutput() then
          el.content:insert(1, pandoc.Span(
            stringToInlines(section),
            pandoc.Attr("", { "header-section-number"})
          ))
        else
          tprepend(el.content, stringToInlines(section))
        end

        if appendix then
          el.content:insert(1, pandoc.Space())
          tprepend(el.content, crossrefOption("appendix-title", stringToInlines("Appendix")))
        end

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
  return (not _quarto.format.isLatexOutput() or _quarto.format.isBeamerOutput()) and 
         not _quarto.format.isTypstOutput() and
         not _quarto.format.isMarkdownOutput() 
         and numberSectionsOptionEnabled()
end

function numberSectionsOptionEnabled()
  return param("number-sections", false)
end

function numberDepth() 
  return param("number-depth", 6)
end

