function Pandoc()
  if quarto.doc.is_format("html:js") then
    quarto.doc.add_html_dependency({
      name = "quarto-auto-dark-mode",
      version = "1.0.0",
      stylesheets = {"auto-dark-mode.css"}
    })
  end
end
