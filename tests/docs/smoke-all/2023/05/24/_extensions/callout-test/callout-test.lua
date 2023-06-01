return {
  ['callout-test'] = function(args, kwargs, meta) 
    local calloutDiv = {}
    calloutDiv["type"] = "note"
    calloutDiv["icon"] = false
    calloutDiv["title"] = "Test"
    calloutDiv["content"] = { pandoc.Str("This is a test.") }
    
    calloutOut = quarto.Callout(calloutDiv)
    
    return calloutOut
  end
}
