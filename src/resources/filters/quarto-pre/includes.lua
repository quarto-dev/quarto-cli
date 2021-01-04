-- includes.lua
-- Copyright (C) 2020 by RStudio, PBC

kIncludeBeforeBody = "include-before-body"
kIncludeAfterBody = "include-after-body"
kIncludeInHeader = "include-in-header"

function readIncludes()
  return {
    Pandoc = function(doc)
      -- ensure all includes are meta lists
      ensureIncludes(doc, kHeaderIncludes)
      ensureIncludes(doc, kIncludeBefore)
      ensureIncludes(doc, kIncludeAfter)
      
      -- read text based includes
      readIncludeStrings(doc, kHeaderIncludes)
      readIncludeStrings(doc, kIncludeBefore)
      readIncludeStrings(doc, kIncludeAfter)
      
      -- read file includes
      readIncludeFiles(doc, kIncludeInHeader, kHeaderIncludes)
      readIncludeFiles(doc, kIncludeBeforeBody, kIncludeBefore)
      readIncludeFiles(doc, kIncludeAfterBody, kIncludeAfter)
     
      return doc
    end
  }
end

function readIncludeStrings(doc, includes)
  local strs = param(includes, {})
  for _,str in ipairs(strs) do
    if str.t == "MetaBlocks" then
      doc.meta[includes]:insert(str)
    else
      if type(str) == "table" then
        str = inlinesToString(str)
      end
      addInclude(doc, FORMAT, includes, str)
    end
   
  end
end

function readIncludeFiles(doc, includes, target)

  -- process include files
  local files = param(includes, {})
  for _,file in ipairs(files) do
    -- read file contents
    local f = io.open(inlinesToString({file[1]}), "r")
    local contents = f:read("*all")
    f:close()
    -- write as as raw include
    addInclude(doc, FORMAT, target, contents)
  end

  
end