
-- Reformat all heading text 
function RemoveClass(el)
  class = "quarto-exclude-from-search-index"
  if el.classes:includes(class) then
    el.classes:remove(class)
  end
end
