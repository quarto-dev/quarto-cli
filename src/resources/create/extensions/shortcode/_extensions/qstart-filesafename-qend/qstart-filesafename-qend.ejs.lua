return {
  ['<%= filesafename %>'] = function(args, kwargs, meta, raw_args, context) 
    -- see https://quarto.org/docs/extensions/shortcodes.html
    -- for documentation on shortcode development
    return pandoc.Str("Hello from ${title}!")
  end
}