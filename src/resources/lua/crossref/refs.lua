

function resolveRefs(citeEl)

  -- scan citations for refs
  local refs = pandoc.List:new()
  for _, cite in ipairs (citeEl.citations) do
    local entry = crossref.index.entries[cite.id]
    if entry ~= nil then
       local type = text.sub(cite.id, 1, 3)

       -- if parent, need to resolve that and treat as sub

       refs:extend({
         pandoc.Str(type),
         pandoc.Space(),
         pandoc.Str(tostring(entry.order))
       })
    end
  end

  -- swap citeEl for refs if we found any
  if #refs > 0 then
    return refs
  else
    return citeEl
  end
end
