-- theorems.lua
-- Copyright (C) 2020 by RStudio, PBC

-- available theorem types
theoremTypes = {
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

function hasTheoremRef(el)
  local type = refType(el.attr.identifier)
  return theoremTypes[type] ~= nil
end

proofTypes = {
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

function proofType(el)
  local type = el.attr.classes:find_if(function(clz) return proofTypes[clz] ~= nil end)
  if type ~= nil then
    return proofTypes[type]
  else
    return nil
  end

end