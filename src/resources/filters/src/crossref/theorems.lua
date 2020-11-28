

function theorems()

  local types = theoremTypes()

  return {
    Div = function(el)

      local type = refType(el.attr.identifier)
      if types[type] then
        local label = el.attr.identifier
        local name = el.attr.attributes["name"]
        dump(label)
        dump(name)
      end
    end
  }

end

function theoremTypes()
  return {
    thm = {
      env = "theorem",
      style = "plain",
      title = "Theorem"
    },
    lem = {
      env = "lemma",
      style = "plain",
      title = "Lemma"
    }
  }
end
