-- render-asciidoc.lua
-- Copyright (C) 2020-2022 Posit Software, PBC


local kAsciidocNativeCites = require("modules/constants").kAsciidocNativeCites

function render_asciidoc()   

  -- This only applies to asciidoc output
  if not quarto.doc.isFormat("asciidoc") then
    return {}
  end

  local hasMath = false

  return {
    Meta = function(meta)
      if hasMath then
        meta['asciidoc-stem'] = 'latexmath'
      end 

      -- We construct the title with cross ref information into the metadata
      -- if we see such a title, we need to move the identifier up outside the title
      local titleInlines = meta['title']
      if titleInlines ~= nil and #titleInlines == 1 and titleInlines[1].t == 'Span' then ---@diagnostic disable-line
        
        ---@type pandoc.Span
        local span = titleInlines[1]
        local identifier = span.identifier
        
        -- if there is an identifier in the title, we should take over and emit
        -- the proper asciidoc
        if identifier ~= nil then
          -- this is a chapter title, tear out the id and make it ourselves
          local titleContents = pandoc.write(pandoc.Pandoc({span.content}), "asciidoc")
          meta['title'] = pandoc.RawInline("asciidoc", titleContents)
          meta['title-prefix'] = pandoc.RawInline("asciidoc", "[[" .. identifier .. "]]")
        end
      end

      return meta
    end,
    Math = function(el)
      hasMath = true;
    end,
    Cite = function(el) 
      -- If quarto is going to be processing the cites, go ahead and convert
      -- them to a native cite
      if param(kAsciidocNativeCites) then
        local citesStr = table.concat(el.citations:map(function (cite) 
          return '<<' .. cite.id .. '>>'
        end))
        return pandoc.RawInline("asciidoc", citesStr);
      end
    end,
    Callout = function(el) 
      -- callout -> admonition types pass through
      local admonitionType = el.type:upper()

      local admonitionPre
      local admonitionPost = "====\n\n" 

      if el.title and #pandoc.utils.stringify(el.title) > 0 then
        -- A titled admonition
        local admonitionTitle = pandoc.write(pandoc.Pandoc({el.title}), "asciidoc")
        admonitionPre = "[" .. admonitionType .. "]\n." .. admonitionTitle .. "====\n"
      else
        -- A titleless admonition
        admonitionPre = "[" .. admonitionType .. "]\n====\n"
      end

      if el.content.t == "Para" then
        el.content.content:insert(1, pandoc.RawInline("asciidoc", admonitionPre))
        el.content.content:insert(pandoc.RawInline("asciidoc", "\n" .. admonitionPost))
      elseif pandoc.utils.type(el.content) == "Blocks" then
        el.content:insert(1, pandoc.RawBlock("asciidoc", admonitionPre))
        el.content:insert(pandoc.RawBlock("asciidoc", admonitionPost))
      end
      return el.content
    end,
    Inlines = function(el)
      -- Walk inlines and see if there is an inline code followed directly by a note. 
      -- If there is, place a space there (because otherwise asciidoc may be very confused)
      for i, v in ipairs(el) do

        if v.t == "Code" then
          if el[i+1] and el[i+1].t == "Note" then

            local noteEl = el[i+1]
            -- if the note contains a code inline, we need to add a space
            local hasCode = false
            _quarto.module.jog(noteEl, {
              Code = function(_el)
                hasCode = true
              end
            })

            -- insert a space
            if hasCode then
              table.insert(el, i+1, pandoc.RawInline("asciidoc", "{empty}"))
            end
          end
        end
        
      end
      return el

    end
  }
end


