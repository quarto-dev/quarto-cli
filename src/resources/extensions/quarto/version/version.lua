return {
  ['version'] = function(args, kwargs, meta)
    return table.concat(quarto.version, '.')
  end
}
