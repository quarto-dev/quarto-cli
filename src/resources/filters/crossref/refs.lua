-- refs.lua
-- Copyright (C) 2020-2022 Posit Software, PBC


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
        if type ~= nil and isValidRefType(type) then
          local upper = not not string.match(cite.id, "^[A-Z]")

          -- convert the first character of the label to lowercase for lookups
          label = pandoc.text.lower(label:sub(1, 1)) .. label:sub(2)
        
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
              
              -- some special handling to detect chapters and use
              -- an alternate prefix lookup
              local prefixType = type
              local chapters = crossrefOption("chapters", false)
              if chapters and entry then
                if resolve and type == "sec" and isChapterRef(entry.order.section) then
                  if entry.appendix then
                    prefixType = "apx"
                  else
                    prefixType = "ch"
                  end
                end
              end
              if resolve or type ~= "sec" then
                local prefix = refPrefix(prefixType, upper)
                if #prefix > 0 then
                  ref:extend(prefix)
                  ref:extend({nbspString()})
                end
              end
              
            end
  
            -- for latex inject a \ref, otherwise format manually
            if _quarto.format.isLatexOutput() then
              ref:extend({pandoc.RawInline('latex', '\\ref{' .. label .. '}')})
            elseif _quarto.format.isAsciiDocOutput() then
              ref = pandoc.List({pandoc.RawInline('asciidoc', '<<' .. label .. '>>')})
            elseif _quarto.format.isTypstOutput() then
              ref = pandoc.List({pandoc.RawInline('typst', '@' .. label)})
            else
              if not resolve then
                local refClasses = pandoc.List({"quarto-unresolved-ref"})
                if #cite.prefix > 0 or cite.mode == pandoc.SuppressAuthor then
                  refClasses:insert("ref-noprefix")
                end
                local refSpan = pandoc.Span(
                  stringToInlines(label), 
                  pandoc.Attr("", refClasses)
                )
                ref:insert(refSpan)
              elseif entry ~= nil then
                if entry.parent ~= nil then
                  local parentType = refType(entry.parent)
                  local parent = crossref.index.entries[entry.parent]
                  ref:extend(refNumberOption(parentType,parent))
                  ref:extend({pandoc.Space(), pandoc.Str("(")})
                  ref:extend(subrefNumber(entry.order))
                  ref:extend({pandoc.Str(")")})
                else
                  ref:extend(refNumberOption(type, entry))
                end
              end
  
                -- link if requested
              if (refHyperlink()) then
                ref = {pandoc.Link(ref, "#" .. label, "", pandoc.Attr("", {'quarto-xref'}))}
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

function autoRefLabel(refType)
  local index = 1
  while true do
    local label = refType .. "-" .. "__quarto_auto_label-" .. tostring(index)
    if not crossref.autolabels:includes(label) then
      crossref.autolabels:insert(label)
      return label
    else
      index = index + 1
    end
  end
end

function autoSubrefLabel(parentId)
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

function isValidRefType(type) 
  return tcontains(validRefTypes(), type)
end

function validRefTypes()
  local types = tkeys(theoremTypes)
  for k, _ in pairs(crossref.categories.by_ref_type) do
    table.insert(types, k)
    -- if v.type ~= nil and not tcontains(types, v.type) then
    --   table.insert(types, v.type)
    -- end
  end
  -- table.insert(types, "fig")
  -- table.insert(types, "tbl")
  -- table.insert(types, "lst")
  table.insert(types, "eq")
  table.insert(types, "sec")
  return types
end

