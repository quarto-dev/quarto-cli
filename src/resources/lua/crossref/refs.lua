

function resolveRefs(citeEl)

  -- scan citations for refs
  local refs = pandoc.List:new()
  for _, cite in ipairs (citeEl.citations) do
    local entry = crossref.index.entries[cite.id]
    if entry ~= nil then
       local type = string.match(cite.id, "^(%a+)%:")

       -- captial letter
       -- explicit prefix
       -- minues for no prefix
       -- if parent, need to resolve that and treat as sub

       refs:extend({ pandoc.Str(type .. ".\u{a0}")})
       refs:extend(numberOption(type, entry.order))
    end
  end

  -- swap citeEl for refs if we found any
  if #refs > 0 then
    return refs
  else
    return citeEl
  end
end
