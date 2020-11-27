
function resolveRefs()

  return {
    Cite = function(citeEl)
      -- scan citations for refs
      local refs = pandoc.List:new()
      for i, cite in ipairs (citeEl.citations) do
        local entry = crossref.index.entries[text.lower(cite.id)]
        if entry ~= nil then
          -- get the type (note if it's uppercase)
          local type = refType(cite.id)
          local upper = not not string.match(cite.id, "^[A-Z]")
          type = text.lower(type)

          -- get the label
          local label = text.lower(cite.id)

          -- preface with delimiter unless this is citation 1
          if (i > 1) then
            refs:extend(refDelim())
            refs:extend(stringToInlines(" "))
          end

          -- create ref text
          local ref = pandoc.List:new()
          if #cite.prefix > 0 then
            ref:extend(cite.prefix)
            ref:extend({nbspString()})
          elseif cite.mode ~= pandoc.SuppressAuthor then
            ref:extend(refPrefix(type, upper))
            ref:extend({nbspString()})
          end

          -- for latex inject a \ref, otherwise format manually
          if isLatexOutput() then
            ref:extend({pandoc.RawInline('latex', '\\ref{' .. label .. '}')})
          else
            if entry.parent ~= nil then
              local parentType = refType(entry.parent)
              local parent = crossref.index.entries[entry.parent]
              ref:extend(numberOption(parentType,parent.order))
              ref:extend({pandoc.Space(), pandoc.Str("(")})
              ref:extend(subfigNumber(entry.order))
              ref:extend({pandoc.Str(")")})
            else
              ref:extend(numberOption(type, entry.order))
            end
              -- link if requested
            if (refHyperlink()) then
              ref = {pandoc.Link:new(ref, "#" .. label)}
            end
          end

          -- add the ref
          refs:extend(ref)

        end
      end

      -- swap citeEl for refs if we found any
      if #refs > 0 then
        return refs
      else
        return citeEl
      end


    end
  }
end

function refLabel(type, inline)
  return string.match(inline.text, "^{#(" .. type .. ":[^ }]+)}$")
end

function refType(id)
  return string.match(id, "^(%a+)%:")
end

