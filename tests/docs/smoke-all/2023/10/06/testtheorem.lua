local found_it = false

function Theorem(thm)
  found_it = true
end

function Pandoc(doc)
  if not found_it then
    crash()
  end
end

