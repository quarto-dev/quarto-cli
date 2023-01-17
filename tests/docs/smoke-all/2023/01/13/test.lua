local found_it = false

function Emph(s)
  found_it = true
end

function Pandoc(doc)
  if not found_it then
    crash_with_stack_trace()
  end
end