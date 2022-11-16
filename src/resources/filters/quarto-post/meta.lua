-- meta.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- inject metadata
function quartoPostMetaInject()
  return {
    Meta = function(meta)
      metaInjectLatex(meta, function(inject)
        if postState.usingTikz then
          inject(usePackage("tikz"))
        end
      end)
      
      -- Purge the twitter card / creator metadata
      -- Citeproc interprets this as a cite, and provides
      -- a warning of unresolve citation. But we know
      -- that a citation is never allowed in the creator field
      if meta.website ~= nil and meta.website['twitter-card'] ~= nil and type(meta.website['twitter-card']) == 'table' then
        meta.website['twitter-card'].creator = nil
        meta.website['twitter-card'].site = nil
      end

      return meta
    end
  }
end

