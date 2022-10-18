return {
  ['<%= filesafename %>'] = function(args, kwargs, meta) 
    return pandoc.Str("Hello from ${title}!")
  end
}