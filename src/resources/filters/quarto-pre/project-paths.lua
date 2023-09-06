-- project_paths.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

local constants = require("modules/constants")

local function resolveProjectPath(path)
  local offset = _quarto.projectOffset()
  if offset and path and startsWith(path, '/') then
    return pandoc.path.join({offset, pandoc.text.sub(path, 2, #path)})
  else
    return nil
  end
end

-- resources that have '/' prefixed paths are treated as project
-- relative paths if there is a project context. For HTML output, 
-- these elements are dealt with in a post processor in website-resources.ts:resolveTag()
-- but for non-HTML output, we fix these here.
function project_paths()
  return {
    Image = function(el)
      if el.attr.attributes[constants.kProjectResolverIgnore] then
        el.attr.attributes[constants.kProjectResolverIgnore] = ''
        return el
      end

      local resolved = false

      -- Resolve the image source
      if el.src then
        local resolvedPath = resolveProjectPath(el.src)
        if resolvedPath ~= nil then
          el.src = resolvedPath
          resolved = true
        end
      end

      -- Resolve image data-src
      if el.attributes['data-src'] then
        local resolvedPath = resolveProjectPath(el.attributes['data-src'])
        if resolvedPath ~= nil then
          el.attributes['data-src'] = resolvedPath
          resolved = true
        end
      end

      if resolved then
        return el
      end
    end,

    Link = function(el)
      if el.attr.attributes[constants.kProjectResolverIgnore] then
        el.attr.attributes[constants.kProjectResolverIgnore] = ''
        return el
      end

      if el.target then
        local resolvedHref = resolveProjectPath(el.target)
        if resolvedHref then
          el.target = resolvedHref
          return el
        end
      end
    end
  }
end


