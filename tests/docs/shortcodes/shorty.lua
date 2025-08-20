

return {
  shorty = function(args)
    if args[1] == "error_args" then
      return quarto.shortcode.error_output("shorty", args, "inline")
    elseif args[1] == "error" then
      return quarto.shortcode.error_output("shorty", "error message", "inline")
    else
      return pandoc.Strong(args[1])
    end
  end
}

