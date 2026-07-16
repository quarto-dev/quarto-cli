-- includes.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

function read_includes(meta)
  -- return {
  --   Meta = function(meta)
      -- ensure all includes are meta lists
      ensureIncludes(meta, _quarto.modules.constants.kHeaderIncludes)
      ensureIncludes(meta, _quarto.modules.constants.kIncludeBefore)
      ensureIncludes(meta, _quarto.modules.constants.kIncludeAfter)
          
      -- read file includes
      readIncludeFiles(meta, _quarto.modules.constants.kIncludeInHeader, _quarto.modules.constants.kHeaderIncludes)
      readIncludeFiles(meta, _quarto.modules.constants.kIncludeBeforeBody, _quarto.modules.constants.kIncludeBefore)
      readIncludeFiles(meta, _quarto.modules.constants.kIncludeAfterBody, _quarto.modules.constants.kIncludeAfter)

      -- read text based includes
      readIncludeStrings(meta, _quarto.modules.constants.kHeaderIncludes)
      readIncludeStrings(meta, _quarto.modules.constants.kIncludeBefore)
      readIncludeStrings(meta, _quarto.modules.constants.kIncludeAfter)
     
      return meta
  --   end
  -- }
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
      local f = io.open(pandoc.utils.stringify(file), "rb")
      if f == nil then 
        fail("Error resolving " .. target .. "- unable to open file " .. file)
      end
      local contents = f:read("*all")
      f:close()
      -- write as as raw include
      addInclude(meta, FORMAT, target, contents)
    end)
  end

  
end