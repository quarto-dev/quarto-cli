-- jats.lua
-- Copyright (C) 2021-2022 Posit Software, PBC





function jats()
  return {

    Meta = function(meta) 
      -- inspect the meta and set flags that will aide the rendering of
      -- the JATS template by providing some synthesize properties
      -- to prevent empty container XML elements

      -- are there author notes?
      local authors = meta['authors']
      if authors ~= nil then

        -- has author notes
        local hasNotes = authors:find_if(function(author) 
          local hasAttr = author['attributes'] ~= nil and next(author['attributes'])
          local hasNote = author['note'] and next(author['note'])
          return hasAttr or hasNote
        end)

        -- has permissions
        local hasCopyright = meta['copyright'] ~= nil
        local hasLicense = meta['license'] ~= nil
        local hasPermissions = hasCopyright or hasLicense
  
        if meta['quarto-internal'] == nil then
          meta['quarto-internal'] = {}
        end
        meta['quarto-internal']['has-author-notes'] = hasNotes;
        meta['quarto-internal']['has-permissions'] = hasPermissions;

        return meta
      end


    end,

    -- clear out divs
    Div = function(div)
      if _quarto.format.isJatsOutput() then
        -- unroll blocks contained in divs
        local blocks = pandoc.List()
        for _, childBlock in ipairs(div.content) do
          if childBlock.t == "Div" then
            tappend(blocks, childBlock.content)
          else
            blocks:insert(childBlock)
          end
        end
        return blocks
      end
    end
  }
end
