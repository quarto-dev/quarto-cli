knitr_fixup = function()
  return {
    -- https://github.com/quarto-dev/quarto-cli/issues/4869
    -- knitr:::eng_sql is badly design and escape our cell-output wrapping in R
    -- so we need to fix it up here by detecting the <div> which will be seen as DIV because 
    -- we use +native_divs by default
    -- TODO: only do this when md is generated from engine knitr
    Div = function(e)
      if e.classes:includes("knitsql-table") then
        return pandoc.Div(e.content, { class = "cell-output-display" })
      end
      return e
    end
  }
end