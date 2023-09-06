-- book-links.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

function index_book_file_targets() 
    if not param("single-file-book", false) then
      return {} 
    else 
      return {
        Header = function(el)
          if el.level == 1 then 
            local file = currentFileMetadataState().file
            if file ~= nil then   
              local filename = file.bookItemFile;
              if filename ~= nil and quarto_global_state.fileSectionIds[filename] == nil then
                quarto_global_state.fileSectionIds[filename] = el.identifier
              end
            end
          end
        end
      }
  end
end

function resolve_book_file_targets() 
  if not param("single-file-book", false) then
    return {} 
  else
    return {
      Link = function(el)
        local linkTarget = el.target
        -- if this is a local path
        if isRelativeRef(linkTarget) then
          local file = currentFileMetadataState().file
  
          -- normalize the linkTarget (collapsing any '..')
          if #linkTarget > 0 then
            local fullPath = linkTarget
            if file ~= nil and file.resourceDir ~= nil then
              fullPath = pandoc.path.join({file.resourceDir, linkTarget})
            end
            linkTarget = pandoc.path.normalize(flatten(fullPath));
          end
          
          -- resolve the path
          local hashPos = string.find(linkTarget, '#')
          if hashPos ~= nil then
            -- deal with a link that includes a hash (just remove the prefix)
            local target = string.sub(linkTarget, hashPos, #linkTarget)
            el.target = target
          else
            -- Deal with bare file links
            -- escape windows paths if present
            package.config:sub(1,1)
            
            -- Paths are always using '/' separator (even on windows)
            linkTarget = linkTarget:gsub("\\", "/")
            local sectionId = quarto_global_state.fileSectionIds[linkTarget];
            if sectionId ~= nil then
              el.target = '#' .. sectionId
            end
          end
        end
        return el
      end 
    }  
  end
end

function flatten(targetPath) 
  local pathParts = pandoc.path.split(targetPath)
  local resolvedPath = pandoc.List()

  -- FIXME are we not handling "."?
  for _, part in ipairs(pathParts) do 
    if part == '..' then
      table.remove(resolvedPath)
    else
      resolvedPath:insert(part)
    end
  end
  return pandoc.path.join(resolvedPath)
end