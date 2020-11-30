-- resolve references
function resolveRefs()
  
  return {
    Cite = function(citeEl)
      
      -- all valid ref types (so we can provide feedback when one doesn't match)
      local refTypes = validRefTypes()
      
      -- scan citations for refs
      local refs = pandoc.List:new()
      for i, cite in ipairs (citeEl.citations) do
        -- get the label and type, and note if the label is uppercase
        local label = text.lower(cite.id)
        local type = refType(label)
        local upper = not not string.match(cite.id, "^[A-Z]")
        
        -- lookup the label
        local entry = crossref.index.entries[label]
        if entry ~= nil then
      
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

        -- no entry for this reference, if it has a valid ref prefix
        -- then yield error text
        elseif tcontains(refTypes, type) then
          local err = pandoc.Strong({ pandoc.Str("?@" .. label) })
          refs:extend({err})
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

function validRefTypes()
  local types = tkeys(theoremTypes())
  table.insert(types, "fig")
  table.insert(types, "tbl")
  table.insert(types, "eq")
  table.insert(types, "lst")
  return types
end

