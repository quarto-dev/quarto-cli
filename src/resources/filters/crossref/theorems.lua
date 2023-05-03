-- theorems.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- preprocess theorem to ensure that embedded headings are unnumered
function crossref_preprocess_theorems()
  local types = theoremTypes
  return {
    Div = function(el)
      local type = refType(el.attr.identifier)
      if types[type] ~= nil or proofType(el) ~= nil then
        return _quarto.ast.walk(el, {
          Header = function(el)
            el.classes:insert("unnumbered")
            return el
          end
        })
      end

    end
  }
end

function crossrefTheorems()

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
        if not name or #name == 0 then
          name = resolveHeadingCaption(el)
        end
        el.attr.attributes["name"] = nil 
        
        -- add to index
        local label = el.attr.identifier
        local order = indexNextOrder(type)
        indexAddEntry(label, nil, order, name)
        
        -- If this theorem has no content, then create a placeholder
        if #el.content == 0 or el.content[1].t ~= "Para" then
          tprepend(el.content, {pandoc.Para({pandoc.Str '\u{a0}'})})
        end
      
        if _quarto.format.isLatexOutput() then
          local preamble = pandoc.Para(pandoc.RawInline("latex", 
            "\\begin{" .. theoremType.env .. "}"))
          preamble.content:insert(pandoc.RawInline("latex", "["))
          if name then
            tappend(preamble.content, name) 
          end
          preamble.content:insert(pandoc.RawInline("latex", "]"))
          preamble.content:insert(pandoc.RawInline("latex",
            "\\protect\\hypertarget{" .. label .. "}{}\\label{" .. label .. "}")
          )
          el.content:insert(1, preamble)
          el.content:insert(pandoc.Para(pandoc.RawInline("latex", 
            "\\end{" .. theoremType.env .. "}"
          )))
          -- Remove id on those div to avoid Pandoc inserting \hypertaget #3776
          el.attr.identifier = ""
        elseif _quarto.format.isJatsOutput() then

          -- JATS XML theorem
          local lbl = captionPrefix(nil, type, theoremType, order)
          el = jatsTheorem(el, lbl, name)          
          
        else
          -- create caption prefix
          local captionPrefix = captionPrefix(name, type, theoremType, order)
          local prefix =  { 
            pandoc.Span(
              pandoc.Strong(captionPrefix), 
              pandoc.Attr("", { "theorem-title" })
            )
          }

          -- prepend the prefix
          local caption = el.content[1]

          if caption.content == nil then
            -- https://github.com/quarto-dev/quarto-cli/issues/2228
            -- caption doesn't always have a content field; in that case,
            -- use the parent?
            tprepend(el.content, prefix)
          else
            tprepend(caption.content, prefix)
          end
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
          if not name or #name == 0 then
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
          elseif _quarto.format.isJatsOutput() then
            el = jatsTheorem(el,  nil, name )
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

            -- if the first block is a paragraph, then prepend the title span
            if #el.content > 0 and 
               el.content[1].t == "Para" and
               el.content[1].content ~= nil and 
               #el.content[1].content > 0 then
              el.content[1].content:insert(1, span)
            else
              -- else insert a new paragraph
              el.content:insert(1, pandoc.Para{span})
            end
          end

        end

      end
     
      return el
    
    end
  }

end

function jatsTheorem(el, label, title) 

  -- <statement>
  --   <label>Equation 2</label>
  --   <title>The Pythagorean</title>
  --   <p>
  --     ...
  --   </p>
  -- </statement> 

  if title then
    tprepend(el.content, {
      pandoc.RawBlock("jats", "<title>"),  
      pandoc.Plain(title), 
      pandoc.RawBlock("jats", "</title>")})
  end

  if label then
    tprepend(el.content, {
      pandoc.RawBlock("jats", "<label>"),  
      pandoc.Plain(label), 
      pandoc.RawBlock("jats", "</label>")})
  end
  
  -- Process the caption (if any)
  
  -- Emit the statement
  local stmtPrefix = pandoc.RawBlock("jats",  '<statement id="' .. el.attr.identifier .. '">')
  local stmtSuffix = pandoc.RawBlock("jats",  '</statement>')

  el.content:insert(1, stmtPrefix)
  el.content:insert(stmtSuffix)
  return el
end

function captionPrefix(name, type, theoremType, order) 
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
  return prefix
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
      "\\AtBeginDocument{\\renewcommand*{\\proofname}{" .. envTitle("proof", "Proof") .. "}}\n" ..
      "\\newtheorem*{remark}{" .. envTitle("remark", "Remark") .. "}\n" ..
      "\\newtheorem*{solution}{" .. envTitle("solution", "Solution") .. "}\n"
    return theoremIncludes
  else
    return nil
  end
end

