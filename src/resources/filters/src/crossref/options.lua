

function initOptions()
  return {
    Pandoc = function(doc)
      if type(doc.meta["crossref"]) == "table" then
        crossref.options = doc.meta["crossref"]
      end
      return doc
    end
  }
end

function option(name, default)
  local value = crossref.options[name]
  if value == nil then
    value = default
  end
  return value
end



