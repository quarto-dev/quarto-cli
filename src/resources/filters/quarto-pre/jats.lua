-- jats.lua
-- Copyright (C) 2021-2022 Posit Software, PBC

function jatsSubarticlePre() 

  if _quarto.format.isJatsOutput() then

    -- Xref identifiers can appear within subarticles, so 
    -- we need to actually create a subarticle identifier
    -- so that we form a unique identifier (sub-article ids still
    -- must be unique across the whole document)

    -- TODO: Need to properly handle all cross referenceable types
    local function subArticleIdentifier(identifier)
      if isFigureRef(identifier) or isTableRef(identifier) or isListingRef(identitifer) then
        return identifier .. '-' .. subarticleId()
      else
        return identifier
      end
    end
    
    return {
      Figure = function(figure)
        figure.identifier = subArticleIdentifier(figure.identifier)
        return figure
      end,

      Image = function(image)
        image.identifier = subArticleIdentifier(image.identifier)
        return image
      end,

      Cite = function(cite)
        for i, v in ipairs(cite.citations) do
          cite.citations[i].id = subArticleIdentifier(cite.citations[i].id)
        end
        return cite
      end
    }

  else 
    return {}
  end
end


