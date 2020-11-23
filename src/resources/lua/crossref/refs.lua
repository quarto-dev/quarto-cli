

-- latex links

function resolveRefs(citeEl)

  -- scan citations for refs
  local refs = pandoc.List:new()
  for i, cite in ipairs (citeEl.citations) do
    local entry = crossref.index.entries[text.lower(cite.id)]
    if entry ~= nil then
      -- get the type (note if it's uppercase)
      local type = refType(cite.id)
      local upper = not not string.match(cite.id, "^[A-Z]")
      type = text.lower(type)

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

      -- add number (check for parent)
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
        ref = {pandoc.Link:new(ref, "#" .. text.lower(cite.id))}
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


function refType(id)
  return string.match(id, "^(%a+)%:")
end

