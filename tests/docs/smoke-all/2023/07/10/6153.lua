
local svg_blocks = 0

function RawBlock(el)
  if el.text:match("svg") then
    svg_blocks = svg_blocks + 1
  end
end

function Pandoc(doc)
  if svg_blocks ~= 1 then
    error("Should have found exactly one rawblock with 'svg' in it")
    crash_with_stack_trace()
  end
end