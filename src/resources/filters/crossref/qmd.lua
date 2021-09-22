-- qmd.lua
-- Copyright (C) 2020 by RStudio, PBC

function isQmdInput()
  return param("crossref-input-type", "md") == "qmd"
end

function qmd()
  if isQmdInput() then
    return {
      -- for qmd, look for label: and fig-cap: inside code block text
      CodeBlock = function(el)
        local label = el.text:match("|%slabel:%s(%a+%-%a+)\n")
        if label ~= nil and isFigureRef(label) then
          local figCap = el.text:match("|%sfig%-cap:%s(.-)\n")
          if figCap ~= nil then
            -- remove enclosing quotes (if any)
            if figCap:sub(1, 1) == '"' then
              figCap = figCap:sub(2, #figCap)
            end
            if figCap:sub(#figCap, #figCap) == '"' then
              figCap = figCap:sub(1, #figCap - 1)
            end
            -- replace escaped quotes
            figCap = figCap:gsub('\\"', '"')
            -- add to index
            local order = indexNextOrder("fig")
            indexAddEntry(label, nil, order, stringToInlines(figCap))
          end
        end
        return el
      end
    }
  else
    return {}
  end
end