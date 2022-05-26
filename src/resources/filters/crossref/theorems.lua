-- theorems.lua
-- Copyright (C) 2020 by RStudio, PBC

function theorems()

  local types = theoremTypes

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
        if not name then
          name = resolveHeadingCaption(el)
        end
        el.attr.attributes["name"] = nil 
        
        -- add to index
        local label = el.attr.identifier
        local order = indexNextOrder(type)
        indexAddEntry(label, nil, order, name)
      
        if _quarto.format.isLatexOutput() then
          local preamble = pandoc.Para(pandoc.RawInline("latex", 
            "\\begin{" .. theoremType.env .. "}"))
          preamble.content:insert(pandoc.RawInline("latex", "["))
          if name then
            tappend(preamble.content, name) 
          end
          preamble.content:insert(pandoc.RawInline("latex", "]"))
          preamble.content:insert(pandoc.RawInline("latex",
            "\\label{" .. label .. "}")
          )
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
            tappend(prefix, name)
            table.insert(prefix, pandoc.Str(")"))
            table.insert(prefix, pandoc.Space())
          end
        
          -- add caption paragraph if necessary
          if #el.content < 2 then
            tprepend(el.content,  { pandoc.Para({}) })
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

      else
        -- see if this is a proof, remark, or solution
        local proof = proofType(el)
        if proof ~= nil then

          -- ensure requisite latex is injected
          crossref.usingTheorems = true

          if proof.env ~= "proof" then
            el.attr.classes:insert("proof")
          end

          -- capture then remove name
          local name = markdownToInlines(el.attr.attributes["name"])
          if not name then
            name = resolveHeadingCaption(el)
          end
          el.attr.attributes["name"] = nil 

          -- output
          if _quarto.format.isLatexOutput() then
            local preamble = pandoc.Para(pandoc.RawInline("latex", 
              "\\begin{" .. proof.env .. "}"))
            if name ~= nil then
              preamble.content:insert(pandoc.RawInline("latex", "["))
              tappend(preamble.content, name)
              preamble.content:insert(pandoc.RawInline("latex", "]"))
            end 
            el.content:insert(1, preamble)
            el.content:insert(pandoc.Para(pandoc.RawInline("latex", 
              "\\end{" .. proof.env .. "}"
            )))
          else
            local span = pandoc.Span(
              { pandoc.Emph(pandoc.Str(envTitle(proof.env, proof.title)))},
              pandoc.Attr("", { "proof-title" })
            )
            if name ~= nil then
              span.content:insert(pandoc.Str(" ("))
              tappend(span.content, name)
              span.content:insert(pandoc.Str(")"))
            end
            tappend(span.content, { pandoc.Str(". ")})
            if #el.content > 0 and #el.content[1].content > 0 then
              el.content[1].content:insert(1, span)
            end
          end

        end

      end
     
      return el
    
    end
  }

end


-- theorem latex includes
function theoremLatexIncludes()
  
  -- determine which theorem types we are using
  local types = theoremTypes
  local refs = tkeys(crossref.index.entries)
  local usingTheorems = crossref.usingTheorems
  for k,v in pairs(crossref.index.entries) do
    local type = refType(k)
    if types[type] then
      usingTheorems = true
      types[type].active = true
    end
  end
  
  -- return requisite latex if we are using theorems
  if usingTheorems then
    local secType 
    if crossrefOption("chapters", false) then 
      secType = "chapter" 
    else 
      secType = "section" 
    end
    local theoremIncludes = "\\usepackage{amsthm}\n"
    for _, type in ipairs(tkeys(types)) do
      if types[type].active then
        theoremIncludes = theoremIncludes .. 
          "\\theoremstyle{" .. types[type].style .. "}\n" ..
          "\\newtheorem{" .. types[type].env .. "}{" .. 
          titleString(type, types[type].title) .. "}[" .. secType .. "]\n"
      end
    end
    theoremIncludes = theoremIncludes ..
      "\\theoremstyle{remark}\n" ..
      "\\renewcommand*{\\proofname}{" .. envTitle("proof", "Proof") .. "}\n" ..
      "\\newtheorem*{remark}{" .. envTitle("remark", "Remark") .. "}\n" ..
      "\\newtheorem*{solution}{" .. envTitle("solution", "Solution") .. "}\n"
    return theoremIncludes
  else
    return nil
  end
end

