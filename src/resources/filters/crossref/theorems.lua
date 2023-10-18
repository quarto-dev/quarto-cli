-- theorems.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- preprocess theorem to ensure that embedded headings are unnumered
function crossref_preprocess_theorems()
  local types = theorem_types
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

function crossref_theorems()

  local types = theorem_types

  return {
    Theorem = function(thm)
      local label = thm.identifier
      local type = refType(label)
      thm.order = indexNextOrder(type)
      indexAddEntry(label, nil, thm.order, { thm.name })
      return thm
    end,
    Div = function(el)

      local type = refType(el.attr.identifier)
      local theoremType = types[type]
      if theoremType then
        internal_error()
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
            local begin_env = "\\begin{" .. proof.env .. "}"
            local preamble = pandoc.Plain(pandoc.RawInline("latex", begin_env))
            if name ~= nil then
              preamble.content:insert(pandoc.RawInline("latex", "["))
              tappend(preamble.content, name)
              preamble.content:insert(pandoc.RawInline("latex", "]"))
            end 
            -- https://github.com/quarto-dev/quarto-cli/issues/6077
            if el.content[1].t == "Para" then
              el.content[1].content:insert(1, pandoc.RawInline("latex", begin_env .. "\n"))
            elseif el.content[1].t == "RawBlock" and el.content[1].format == "latex" then
              el.content[1].text = begin_env .. "\n" .. el.content[1].text
            else
              el.content:insert(1, preamble)
            end
            local end_env = "\\end{" .. proof.env .. "}"
            -- https://github.com/quarto-dev/quarto-cli/issues/6077
            if el.content[#el.content].t == "Para" then
              el.content[#el.content].content:insert(pandoc.RawInline("latex", "\n" .. end_env))
            elseif el.content[#el.content].t == "RawBlock" and el.content[#el.content].format == "latex" then
              el.content[#el.content].text = el.content[#el.content].text .. "\n" .. end_env
            else
              el.content:insert(pandoc.Plain(pandoc.RawInline("latex", end_env)))
            end
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
  local types = theorem_types
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

