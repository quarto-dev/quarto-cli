

function theorems()

  local types = theoremTypes()

  return {
    Div = function(el)

      local type = refType(el.attr.identifier)
      local theoremType = types[type]
      if theoremType then
        
        -- add class for type
        el.attr.classes:insert("theorem")
        local class = theoremType.title:lower()
        if class ~= "theorem" then
          el.attr.classes:insert(class)
        end
        
        -- capture then remove name
        local name = el.attr.attributes["name"]
        el.attr.attributes["name"] = nil 
        
        -- add to index
        local label = el.attr.identifier
        local order = indexNextOrder(type)
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
        tprepend(caption.content, { 
          pandoc.Span(
            pandoc.Strong(prefix), 
            pandoc.Attr("", { "theorem-title" })
          )
        })
       
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
