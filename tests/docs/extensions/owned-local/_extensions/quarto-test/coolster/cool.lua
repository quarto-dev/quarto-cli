function cool(args)
    return pandoc.Str("You know what is cool? " .. pandoc.utils.stringify(args[1]) .. '.');
end