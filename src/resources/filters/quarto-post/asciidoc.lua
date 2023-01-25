-- asciidoc.lua
-- Copyright (C) 2020-2022 Posit Software, PBC


local kAsciidocNativeCites = 'use-asciidoc-native-cites'

function asciidoc()   
  return {
    Cite = function(el) 
      if quarto.doc.isFormat("asciidoc") and param(kAsciidocNativeCites) then
        local citesStr = ""
        el.citations:map(function (cite) 
          citesStr = citesStr .. '<<' .. cite.id .. '>>'
        end)
        return pandoc.RawInline("asciidoc", citesStr);
      end
    end
  }
end


