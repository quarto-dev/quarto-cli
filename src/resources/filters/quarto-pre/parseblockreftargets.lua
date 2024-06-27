-- parseblockreftargets.lua
-- Copyright (C) 2023 Posit Software, PBC

-- parses Proofs, Theorems, Lemmas, etc.

function parse_blockreftargets()

  local function parse_theorem_div(el)
    if not has_theorem_ref(el) then
      return
    end
    -- capture then remove name
    local name = markdownToInlines(el.attr.attributes["name"])
    if not name or #name == 0 then
      name = resolveHeadingCaption(el)
    end
    el.attr.attributes["name"] = nil 
    local identifier = el.attr.identifier
    -- remove identifier to avoid infinite recursion
    el.attr.identifier = ""
    return quarto.Theorem {
      identifier = identifier,
      name = name,
      div = el
    }, false
  end

  local function parse_proof_div(el)
    if not is_proof_div(el) then
      return
    end

    local name = string_to_quarto_ast_inlines(el.attributes["name"] or "")
    if not name or #name == 0 then
      name = resolveHeadingCaption(el) or pandoc.Inlines({})
    end
    el.attributes["name"] = nil 
    local identifier = el.identifier
    el.identifier = ""

    local ref = refType(identifier)
    local proof_type
    if ref ~= nil then
      proof_type = crossref.categories.by_ref_type[ref].name
    else
      proof_type = el.classes:find_if(function(clz) return proof_types[clz] ~= nil end)
      if proof_type == nil then
        internal_error()
        return
      end
      proof_type = proof_types[proof_type].title
    end
    el.classes = el.classes:filter(function(clz) return proof_types[clz] == nil end)
    crossref.using_theorems = true
    local tbl = {
      identifier = identifier,
      name = name,
      div = el,
      type = proof_type
    }
    return quarto.Proof(tbl), false
  end

  return {
    Div = function(div)
      if is_theorem_div(div) then
        return parse_theorem_div(div)
      elseif is_proof_div(div) then
        return parse_proof_div(div)
      end
    end
  }
end