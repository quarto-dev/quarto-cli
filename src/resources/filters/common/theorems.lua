-- theorems.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

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