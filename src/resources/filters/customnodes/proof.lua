-- proof.lua
-- custom AST node for proofs, remarks, solutions, etc.

-- Copyright (C) 2023 Posit Software, PBC

-- available proof types

proof_types = {
  proof =  {
    env = 'proof',
    title = 'Proof'
  },
  remark =  {
    env = 'remark',
    title = 'Remark'
  },
  solution = {
    env = 'solution',
    title = 'Solution'
  }
}

function proof_type(el)
  local type = el.attr.classes:find_if(function(clz) return proof_types[clz] ~= nil end)
  if type ~= nil then
    return proof_types[type]
  else
    return nil
  end
end

_quarto.ast.add_handler({
  -- empty table so this handler is only called programmatically
  class_name = {},

  -- the name of the ast node, used as a key in extended ast filter tables
  ast_name = "Proof",

  -- generic names this custom AST node responds to
  -- this is still unimplemented
  interfaces = {"Crossref"},

  -- Proofs are always blocks
  kind = "Block",

  parse = function(div)
    -- luacov: disable
    internal_error()
    -- luacov: enable
  end,

  slots = { "div", "name" },

  constructor = function(tbl)
    return {
      name = tbl.name,
      div = tbl.div,
      identifier = tbl.identifier,
      type = tbl.type -- proofs can be unnumbered and lack an identifier; we need to know the type explicitly
    }
  end
})

function is_proof_div(div)
  local ref = refType(div.identifier)
  if ref ~= nil then
    local tbl = crossref.categories.by_ref_type[ref]
    if tbl then
      local key = tbl.name:lower()
      return proof_types[key]
    end
  end
  return is_regular_node(div, "Div") and proof_type(div) ~= nil
end

_quarto.ast.add_renderer("Proof", function()
  return true 
end, function(proof_tbl)
  local el = proof_tbl.div
  -- see if this is a proof, remark, or solution
  local proof = proof_types[proof_tbl.type:lower()]
  if proof == nil then
    internal_error()
    return pandoc.Blocks({})
  end

  -- ensure requisite latex is injected
  crossref.using_theorems = true

  if proof.env ~= "proof" then
    el.attr.classes:insert("proof")
  end

  local name = quarto.utils.as_inlines(proof_tbl.name or pandoc.Inlines({}))

  -- output
  if _quarto.format.isLatexOutput() then
    local preamble = pandoc.List()
    local env = proof.env

    local has_ref = refType(proof_tbl.identifier) ~= nil
    if has_ref then
      env = "ref" .. env
    end

    preamble:insert(pandoc.RawInline("latex", "\\begin{" .. env .. "}"))
    if #name ~= 0 then
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
    if has_ref then
      el.content:insert(pandoc.RawInline("latex",
        "\\label{" .. proof_tbl.identifier .. "}")
      )
    end
    local end_env = "\\end{" .. env .. "}"
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
    el.classes:insert(proof.title:lower())
    local span_title = pandoc.Emph(pandoc.Str(envTitle(proof.env, proof.title)))
    local entry = crossref.index.entries[proof_tbl.identifier]
    local type = refType(proof_tbl.identifier)
    if type then
      el.identifier = proof_tbl.identifier
    end
    if entry then
      span_title.content:insert(pandoc.Space())
      span_title.content:extend(refNumberOption(type, entry))      
    end

    local span = pandoc.Span({ span_title }, pandoc.Attr("", { "proof-title" }))
    if #name > 0 then
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
    print(el)
  end

  return el

end)