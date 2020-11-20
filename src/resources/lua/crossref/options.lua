

function optionsInit(meta)
  crossref.options = {}
  if type(meta["crossref"]) == "table" then
    crossref.options = meta["crossref"]
  end
end

function option(name, default)
  local value = crossref.options[name]
  if value == nil then
    value = default
  end
  return value
end



