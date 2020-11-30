-- theorems.lua
-- Copyright (C) 2020 by RStudio, PBC

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
          local preamble = pandoc.Para(pandoc.RawInline("latex", 
            "\\begin{" .. theoremType.env .. "}["))
          tappend(preamble.content, name) 
          preamble.content:insert(pandoc.RawInline("latex", "]" ..
            "\\label{" .. label .. "}"))
          el.content:insert(1, preamble)
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
  return pandoc.List({
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
  })
end

-- theorem latex includes
function theoremLatexIncludes()
  
  -- determine which theorem types we are using
  local types = theoremTypes()
  local refs = tkeys(crossref.index.entries)
  local usingTheorems = false
  for k,v in pairs(crossref.index.entries) do
    local type = refType(k)
    if types[type] then
      usingTheorems = true
      types[type].active = true
    end
  end
  
  -- return requisite latex if we are using theorems
  if usingTheorems then
    local theoremIncludes = "\\usepackage{amsthm}\n"
    for _, type in ipairs(tkeys(types)) do
      if types[type].active then
        theoremIncludes = theoremIncludes .. 
          "\\theoremstyle{" .. types[type].style .. "}\n" ..
          "\\newtheorem{" .. types[type].env .. "}{" .. 
          titleString(type, types[type].title) .. "}[section]\n"
      end
    end
    return theoremIncludes
  else
    return nil
  end
end

