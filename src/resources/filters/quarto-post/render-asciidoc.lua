-- render-asciidoc.lua
-- Copyright (C) 2020-2022 Posit Software, PBC


local kAsciidocNativeCites = 'use-asciidoc-native-cites'
local kAsciiDocFormat = "asciidoc"

function renderAsciidoc()   

  -- This only applies to asciidoc output
  if not quarto.doc.isFormat("asciidoc") then
    return {}
  end


  return {
    Cite = function(el) 
      if param(kAsciidocNativeCites) or true then
        local citesStr = table.concat(el.citations:map(function (cite) 
          return '<<' .. cite.id .. '>>'
        end))
        return pandoc.RawInline("asciidoc", citesStr);
      end
    end,
    Callout = function(el) 
      -- types map cleanly
      local admonitionType = el.type:upper();
      local admonitionCaption = el.caption;
      local admonitionContents = el.content;

      local admonitionStr;
      if admonitionCaption then

        local renderedCaption = pandoc.write(pandoc.Pandoc(admonitionCaption), kAsciiDocFormat)
        local renderedContents = pandoc.write(pandoc.Pandoc(admonitionContents), kAsciiDocFormat)
        admonitionStr = "[" .. admonitionType .. "]\n." .. renderedCaption .. "====\n" .. renderedContents .. "====\n\n" 

      else
        local renderedContents = pandoc.write(pandoc.Pandoc(admonitionContents), kAsciiDocFormat)

        -- A captionless admonition
        if #admonitionContents == 1 then
          admonitionStr = admonitionType .. ': ' .. renderedContents
        else
          admonitionStr = "[" .. admonitionType .. "]\n====\n" .. renderedContents .. "====\n\n" 
        end
      end

      return pandoc.RawBlock(kAsciiDocFormat, admonitionStr)
    end
  }
end


