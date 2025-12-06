function typst_path()
  return quarto.paths.typst()
end

return {
  ["typst"] = typst_path
}
