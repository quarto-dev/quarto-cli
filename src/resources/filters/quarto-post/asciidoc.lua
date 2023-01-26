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
    end,
    Callout = function(el) 
      if quarto.doc.isFormat("asciidoc") then

        -- types map cleanly
        local admonitionType = el.type:upper();
        local admonitionCaption = el.caption;
        local admonitionContents = el.content;

        if admonitionCaption then

          -- a captioned admonition
          admonitionCaption:insert(1, pandoc.RawInline("asciidoc", ".") )
          admonitionCaption:insert(1, pandoc.RawInline("asciidoc", "[" .. admonitionType .. "]\n"))
          admonitionCaption:insert(pandoc.RawInline("asciidoc", "\n====\n"))
          tprepend(admonitionContents, {admonitionCaption})
                    
          tappend(admonitionContents, {pandoc.RawInline("asciidoc", "====")})

        else
          -- A captionless admonition
          if #admonitionContents == 1 then

            -- If there is only a single child, we can use a simple decoration of that child
            local typePrefix = {pandoc.RawInline("asciidoc", admonitionType .. ": ") };
            if admonitionContents[1].content then
              tprepend(admonitionContents[1].content, typePrefix)
            else
              tprepend(admonitionContents, typePrefix)
            end
          else

            -- If there are more then one child, we need to wrap all the children
            -- with the more complex syntax
            tprepend(admonitionContents[1].content, {pandoc.RawInline("asciidoc", "====\n")})
            tprepend(admonitionContents[1].content, {pandoc.RawInline("asciidoc", "[" .. admonitionType .. "]\n")})
            tappend(admonitionContents[#admonitionContents].content, {pandoc.RawInline("asciidoc", "\n====")})
          end

        end

        local admonition = pandoc.Div(admonitionContents);
        return admonition
      end
    end
  }
end


