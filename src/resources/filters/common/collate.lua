-- collate.lua
-- Copyright (C) 2023 Posit Software, PBC

-- improved formatting for dumping tables
function collate(lst, predicate)
  local result = pandoc.List({})
  local current_block = pandoc.List({})
  for _, block in ipairs(lst) do
    if #current_block == 0 then
      current_block = pandoc.List({ block })
    else
      if predicate(block, current_block[#current_block]) then
        current_block:insert(block)
      else
        if #current_block > 0 then
          result:insert(current_block)
        end
        current_block = pandoc.List({ block })
      end
    end
  end
  if #current_block > 0 then
    result:insert(current_block)
  end
  return result
end
