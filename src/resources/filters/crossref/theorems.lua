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

