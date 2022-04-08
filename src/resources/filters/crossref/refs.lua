-- refs.lua
-- Copyright (C) 2020 by RStudio, PBC

-- resolve references
function resolveRefs()
  
  return {
    Cite = function(citeEl)
    
      -- all valid ref types (so we can provide feedback when one doesn't match)
      local refTypes = validRefTypes()
      
      -- scan citations for refs
      local refs = pandoc.List()
      for i, cite in ipairs (citeEl.citations) do
        -- get the label and type, and note if the label is uppercase
        local label = cite.id
        local type = refType(label)
        if type ~= nil then
          local upper = not not string.match(cite.id, "^[A-Z]")
        
          -- lookup the label
          local resolve = param("crossref-resolve-refs", true)
          local entry = crossref.index.entries[label]
          if entry ~= nil or not resolve then
        
            -- preface with delimiter unless this is citation 1
            if (i > 1) then
              refs:extend(refDelim())
              refs:extend(stringToInlines(" "))
            end
  
            -- create ref text
            local ref = pandoc.List()
            if #cite.prefix > 0 then
              ref:extend(cite.prefix)
              ref:extend({nbspString()})
            elseif cite.mode ~= pandoc.SuppressAuthor then
              local prefix = refPrefix(type, upper)
              if #prefix > 0 then
                ref:extend(prefix)
                ref:extend({nbspString()})
              end
            end
  
            -- for latex inject a \ref, otherwise format manually
            if isLatexOutput() then
              ref:extend({pandoc.RawInline('latex', '\\ref{' .. label .. '}')})
            else
              if not resolve then
                local refSpan = pandoc.Span(
                  stringToInlines(label), 
                  pandoc.Attr("", {"quarto-unresolved-ref"})
                )
                ref:insert(refSpan)
              else
                if entry.parent ~= nil then
                  local parentType = refType(entry.parent)
                  local parent = crossref.index.entries[entry.parent]
                  ref:extend(numberOption(parentType,parent.order))
                  ref:extend({pandoc.Space(), pandoc.Str("(")})
                  ref:extend(subrefNumber(entry.order))
                  ref:extend({pandoc.Str(")")})
                else
                  ref:extend(numberOption(type, entry.order))
                end
              end
  
                -- link if requested
              if (refHyperlink()) then
                ref = {pandoc.Link(ref, "#" .. label)}
              end
            end
  
            -- add the ref
            refs:extend(ref)
  
          -- no entry for this reference, if it has a valid ref prefix
          -- then yield error text
          elseif tcontains(refTypes, type) then
            warn("Unable to resolve crossref @" .. label)
            local err = pandoc.Strong({ pandoc.Str("?@" .. label) })
            refs:extend({err})
          end
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

function autoRefLabel(parentId)
  local index = 1
  while true do
    local label = parentId .. "-" .. tostring(index)
    if not crossref.autolabels:includes(label) then
      crossref.autolabels:insert(label)
      return label
    else
      index = index + 1
    end
  end
end

function refLabel(type, inline)
  if inline.text then
    return string.match(inline.text, "^" .. refLabelPattern(type) .. "$")
  else
    return nil
  end
end

function extractRefLabel(type, text)
  return string.match(text, "^(.*)" .. refLabelPattern(type) .. "$")
end

function refLabelPattern(type)
  return "{#(" .. type .. "%-[^ }]+)}"
end


function validRefTypes()
  local types = tkeys(theoremTypes)
  table.insert(types, "fig")
  table.insert(types, "tbl")
  table.insert(types, "eq")
  table.insert(types, "lst")
  table.insert(types, "sec")
  return types
end

