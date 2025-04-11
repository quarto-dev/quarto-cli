function RawBlock(raw)
  if raw.format == 'html' and raw.text == '\n' then
    error("New line in raw block should have been removed")
    crash_with_stack_trace()
  end
end