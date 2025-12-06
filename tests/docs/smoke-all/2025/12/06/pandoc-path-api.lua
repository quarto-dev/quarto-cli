function pandoc_path()
  return quarto.paths.pandoc()
end

return {
  ["pandoc"] = pandoc_path
}
