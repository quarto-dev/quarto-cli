return {
  -- returns a placeholder data URI image of the specified size
  ['bug'] = function(args, kwargs, meta)
    if kwargs.foo ~= "bar" then
      crash_with_stack_trace()
    end
    return pandoc.Str("OK")
  end
}