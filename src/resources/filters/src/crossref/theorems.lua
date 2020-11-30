

function theorems()

  local types = theoremTypes()

  return {
    Div = function(el)

      local type = refType(el.attr.identifier)
      local theoremType = types[type]
      if theoremType then
        
        -- add class for type
        el.attr.classes:insert("theorem")
        if theoremType.env ~= "theorem" then
          el.attr.classes:insert(theoremType.env)
        end
        
        -- capture then remove name
        local name = markdownToInlines(el.attr.attributes["name"])
        el.attr.attributes["name"] = nil 
        
        -- add to index
        local label = el.attr.identifier
        local order = indexNextOrder(type)
        indexAddEntry(label, nil, order, name)
      
        if isLatexOutput() then
          el.content:insert(1, pandoc.Para(pandoc.RawInline("latex", 
            "\\begin{" .. theoremType.env .. "}[" .. 
            pandoc.utils.stringify(pandoc.Plain(name)) .. "]" ..
            "\\label{" .. label .. "}"
          )))
          el.content:insert(pandoc.Para(pandoc.RawInline("latex", 
            "\\end{" .. theoremType.env .. "}"
          )))
        else
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
      
      end
     
      return el
    
    end
  }

end

-- available theorem types
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
    },
    cor = {
      env = "corollary",
      style = "plain",
      title = "Corollary",
    },
    prp = {
      env = "proposition",
      style = "plain",
      title = "Proposition",
    },
    cnj = {
      env = "conjecture",
      style = "plain",
      title = "Conjecture"
    },
    def = {
      env = "definition",
      style = "definition",
      title = "Definition",
    },
    exm = {
      env = "example",
      style = "definition",
      title = "Example",
    },
    exr  = {
      env = "exercise",
      style = "definition",
      title = "Exercise"
    }
  }
end

-- are we using theorems in this document?
function usingTheorems()
  local types = tkeys(theoremTypes())
  local refs = tkeys(crossref.index.entries)
  for k,v in pairs(crossref.index.entries) do
    local type = refType(k)
    if tcontains(types, type) then
      return true
    end
  end
  return false
end

