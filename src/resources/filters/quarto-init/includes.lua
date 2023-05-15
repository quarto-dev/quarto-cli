-- includes.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

local constants = require("modules/constants")

function read_includes()
  return {
    Meta = function(meta)
      -- ensure all includes are meta lists
      ensureIncludes(meta, constants.kHeaderIncludes)
      ensureIncludes(meta, constants.kIncludeBefore)
      ensureIncludes(meta, constants.kIncludeAfter)
          
      -- read file includes
      readIncludeFiles(meta, constants.kIncludeInHeader, constants.kHeaderIncludes)
      readIncludeFiles(meta, constants.kIncludeBeforeBody, constants.kIncludeBefore)
      readIncludeFiles(meta, constants.kIncludeAfterBody, constants.kIncludeAfter)

      -- read text based includes
      readIncludeStrings(meta, constants.kHeaderIncludes)
      readIncludeStrings(meta, constants.kIncludeBefore)
      readIncludeStrings(meta, constants.kIncludeAfter)
     
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