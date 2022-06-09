-- includes.lua
-- Copyright (C) 2020 by RStudio, PBC

kIncludeBeforeBody = "include-before-body"
kIncludeAfterBody = "include-after-body"
kIncludeInHeader = "include-in-header"

function readIncludes()
  return {
    Meta = function(meta)
      -- ensure all includes are meta lists
      ensureIncludes(meta, kHeaderIncludes)
      ensureIncludes(meta, kIncludeBefore)
      ensureIncludes(meta, kIncludeAfter)
          
      -- read file includes
      readIncludeFiles(meta, kIncludeInHeader, kHeaderIncludes)
      readIncludeFiles(meta, kIncludeBeforeBody, kIncludeBefore)
      readIncludeFiles(meta, kIncludeAfterBody, kIncludeAfter)

      -- read text based includes
      readIncludeStrings(meta, kHeaderIncludes)
      readIncludeStrings(meta, kIncludeBefore)
      readIncludeStrings(meta, kIncludeAfter)
     
      return meta
    end
  }
end

function readIncludeStrings(meta, includes)
  local strs = param(includes, {})
  for _,str in ipairs(strs) do
    if pandoc.utils.type(str) == "Blocks" then
      meta[includes]:insert(str)
    else
      if type(str) == "table" then
        str = inlinesToString(str)
      end
      addInclude(meta, FORMAT, includes, str)
    end
   
  end
end

function readIncludeFiles(meta, includes, target)

  -- process include files
  local files = param(includes, {})
  for _,file in ipairs(files) do

    local status, err = pcall(function () 
      -- read file contents
      local f = io.open(pandoc.utils.stringify(file), "r")
      if f == nil then 
        error("Error resolving " .. target .. "- unable to open file " .. file)
        os.exit(1)
      end
      local contents = f:read("*all")
      f:close()
      -- write as as raw include
      addInclude(meta, FORMAT, target, contents)
    end)
  end

  
end