-- qmd.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

function isQmdInput()
  return param("crossref-input-type", "md") == "qmd"
end

function qmd()
  if isQmdInput() then
    return {
      -- for qmd, look for label: and fig-cap: inside code block text
      CodeBlock = function(el)
        local label = el.text:match("|%slabel:%s(%a+%-[^\n]+)\n")
        if label ~= nil and (isFigureRef(label) or isTableRef(label)) then
          local type, caption = parseCaption(label, el.text)
          if type == "fig" or type == "tbl" then
            local order = indexNextOrder(type)
            indexAddEntry(label, nil, order, stringToInlines(caption))
          end
        end
        return el
      end
    }
  else
    return {}
  end
end

function parseCaption(label, elText)
  local type, caption = elText:match("|%s(%a+)%-cap:%s(.-)\n")
  if caption ~= nil then
    -- remove enclosing quotes (if any)
    if caption:sub(1, 1) == '"' then
      caption = caption:sub(2, #caption)
    end
    if caption:sub(#caption, #caption) == '"' then
      caption = caption:sub(1, #caption - 1)
    end
    -- replace escaped quotes
    caption = caption:gsub('\\"', '"')

    -- return
    return type, caption
  else
    return nil
  end
  
end