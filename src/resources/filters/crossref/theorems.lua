-- theorems.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- preprocess theorem to ensure that embedded headings are unnumered
function crossref_preprocess_theorems()
  return {
    Div = function(el)
      local type = refType(el.attr.identifier)
      if theorem_types[type] ~= nil or proof_type(el) ~= nil then
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
  return {
    Theorem = function(thm)
      local label = thm.identifier
      local type = refType(label)
      local title = quarto.utils.as_blocks(thm.name)
      thm.order = add_crossref(label, type, title)
      return thm
    end,
    Proof = function(proof)
      local label = proof.identifier
      if label == "" then
        return nil -- it's an unnumbered proof
      end
      local type = refType(label)
      local title = quarto.utils.as_blocks(proof.name)
      proof.order = add_crossref(label, type, title)
      return proof
    end,
    Div = function(el)
      local type = refType(el.attr.identifier)
      local theoremType = theorem_types[type]
      if theoremType then
        internal_error()
      else
        -- see if this is a proof, remark, or solution
        local proof = proof_type(el)
        if proof ~= nil then

          -- ensure requisite latex is injected
          crossref.using_theorems = true

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
            local preamble = pandoc.List()
            preamble:insert(pandoc.RawInline("latex", "\\begin{" .. proof.env .. "}"))
            if name ~= nil then
              preamble:insert(pandoc.RawInline("latex", "["))
              tappend(preamble, name)
              preamble:insert(pandoc.RawInline("latex", "]"))
            end
            preamble:insert(pandoc.RawInline("latex", "\n"))
            -- https://github.com/quarto-dev/quarto-cli/issues/6077
            if el.content[1].t == "Para" then
              preamble:extend(el.content[1].content)
              el.content[1].content = preamble
            else
              if (el.content[1].t ~= "Para") then
                -- required trick to get correct alignement when non Para content first
                preamble:insert(pandoc.RawInline('latex', "\\leavevmode"))
              end
              el.content:insert(1, pandoc.Plain(preamble))
            end
            local end_env = "\\end{" .. proof.env .. "}"
            -- https://github.com/quarto-dev/quarto-cli/issues/6077
            if el.content[#el.content].t == "Para" then
              el.content[#el.content].content:insert(pandoc.RawInline("latex", "\n" .. end_env))
            elseif el.content[#el.content].t == "RawBlock" and el.content[#el.content].format == "latex" then
              -- this is required for no empty line between end_env and previous latex block
              el.content[#el.content].text = el.content[#el.content].text .. "\n" .. end_env
            else
              el.content:insert(pandoc.RawBlock("latex", end_env))
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

  if #title > 0 then
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
  if #name > 0 then
    table.insert(prefix, pandoc.Space())
    table.insert(prefix, pandoc.Str("("))
    tappend(prefix, name)
    table.insert(prefix, pandoc.Str(")"))
  end
  return prefix
end


-- theorem latex includes
function theoremLatexIncludes()
  
  -- determine which theorem types we are using
  local using_theorems = crossref.using_theorems
  for k,v in pairs(crossref.index.entries) do
    local type = refType(k)
    if theorem_types[type] then
      using_theorems = true
      theorem_types[type].active = true
    end
  end
  
  -- return requisite latex if we are using theorems
  if using_theorems then
    local secType 
    if crossrefOption("chapters", false) then 
      secType = "chapter" 
    else 
      secType = "section" 
    end
    local theoremIncludes = "\\usepackage{amsthm}\n"
    for _, type in ipairs(tkeys(theorem_types)) do
      if theorem_types[type].active then
        theoremIncludes = theoremIncludes .. 
          "\\theoremstyle{" .. theorem_types[type].style .. "}\n" ..
          "\\newtheorem{" .. theorem_types[type].env .. "}{" .. 
          titleString(type, theorem_types[type].title) .. "}[" .. secType .. "]\n"
      end
    end
    theoremIncludes = theoremIncludes ..
      "\\theoremstyle{remark}\n" ..
      "\\AtBeginDocument{\\renewcommand*{\\proofname}{" .. envTitle("proof", "Proof") .. "}}\n" ..
      "\\newtheorem*{remark}{" .. envTitle("remark", "Remark") .. "}\n" ..
      "\\newtheorem*{solution}{" .. envTitle("solution", "Solution") .. "}\n" ..
      "\\newtheorem{refremark}{" .. envTitle("remark", "Remark") .. "}[" .. secType .. "]\n" ..
      "\\newtheorem{refsolution}{" .. envTitle("solution", "Solution") .. "}[" .. secType .. "]\n"

    return theoremIncludes
  else
    return nil
  end
end

