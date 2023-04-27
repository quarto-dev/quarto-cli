local count = 0
function RawBlock(el)
  count = count + 1
end

function Pandoc(doc)
  -- the right number to check here is 5 rather than 1
  -- because quarto includes 4 raw blocks in the metadata.
  if count ~= 5 then
    error("failed to merge table blocks")
    crash_with_stack_trace()
  end
end