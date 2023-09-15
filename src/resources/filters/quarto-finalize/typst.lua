-- typst.lua
-- Copyright (C) 2023 Posit Software, PBC

function setup_typst_state()
  if not _quarto.format.isTypstOutput() then
    return {}
  end

  return {
    Pandoc = function(doc)
      if doc.meta.crossref ~= nil then
        local crossref_meta = {}
        for k, v in pairs(doc.meta.crossref) do
          v = pandoc.utils.stringify(v)
          local ref = refType(k)
          local category = crossref.categories.by_ref_type[ref]
          if ref ~= nil and category ~= nil then
            local ref_key = pandoc.utils.stringify(k:sub(ref:len() + 2))
            category[ref_key] = v
          else
            crossref_meta[k] = v
          end
        end
        local json = quarto.json.encode(crossref_meta)
        -- FIXME finish this
      end
      return doc
    end
  }
end