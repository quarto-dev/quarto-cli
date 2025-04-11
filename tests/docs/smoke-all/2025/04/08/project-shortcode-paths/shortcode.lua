return {
    ['my-shortcode'] = function(args, kwargs, meta) 
        return pandoc.Str("Hello from Shorty!")
        end
    }