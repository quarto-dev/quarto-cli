-- jats.lua
-- Copyright (C) 2021-2022 Posit Software, PBC

function jats_subarticle_crossref() 

  if _quarto.format.isJatsOutput() then

    function subarticleId()
      return param("jats-subarticle-id", "")
    end
    
    -- Xref identifiers can appear within subarticles, so 
    -- we need to actually create a subarticle identifier
    -- so that we form a unique identifier (sub-article ids still
    -- must be unique across the whole document)

    -- TODO: Need to properly handle all cross referenceable typescd ..
    local function subArticleIdentifier(identifier)
      if isFigureRef(identifier) or isTableRef(identifier) or isListingRef(identifier) then
        local suffix = '-' .. subarticleId()
        if not identifier:find(suffix .. '$') then
          return identifier .. '-' .. subarticleId()
        else
          return identifier
        end
      else
        return identifier
      end
    end

    local function maybeSubArticlifyId(el)
      if el.identifier ~= nil and el.identifier ~= "" then        
        local currentId = el.identifier
        local newId = subArticleIdentifier(currentId)
        if currentId ~= newId then
          el.identifier = newId
          return el
        end
      end
    end
    
    return {
      
      Block = function(block)
        return maybeSubArticlifyId(block)
      end,

      Image = function(image)
        return maybeSubArticlifyId(image)
      end,

      Cite = function(cite)
        local modified = false
        for i, v in ipairs(cite.citations) do
          local currentId = cite.citations[i].id
          local newId = subArticleIdentifier(currentId)
          if newId ~= currentId then
            cite.citations[i].id = subArticleIdentifier(cite.citations[i].id)
            modified = true
          end
        end
        if modified then
          return cite
        end
      end


    }

  else 
    return {}
  end
end


