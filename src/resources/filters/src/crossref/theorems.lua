

function theorems()

  local types = theoremTypes()

  return {
    Div = function(el)

      local type = refType(el.attr.identifier)
      local theoremType = types[type]
      if theoremType then
        
        -- add class for type
        el.attr.classes:insert(theoremType.title:lower())
        
        -- add to index
        local label = el.attr.identifier
        local order = indexNextOrder(type)
        local name = el.attr.attributes["name"]
        indexAddEntry(label, nil, order, markdownToInlines(name))
      
        -- create caption prefix
        local prefix = title(type, theoremType.title)
        table.insert(prefix, pandoc.Space())
        tappend(prefix, numberOption(type, order))
        table.insert(prefix, pandoc.Space())
        if name then
          table.insert(prefix, pandoc.Str("("))
          tappend(prefix, markdownToInlines(name))
          table.insert(prefix, pandoc.Str(")"))
          table.insert(prefix, pandoc.Space())
        end
      
        -- add caption paragraph if necessary
        if #el.content < 2 then
          tprepend(el.content,  pandoc.Para({}))
        else
         
        end
        
        -- prepend the prefix
        local caption = el.content[1]
        tprepend(caption.content, { pandoc.Strong(prefix) })
       
      end
      return el
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
