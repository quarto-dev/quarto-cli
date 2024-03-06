function quarto_pre_typst_unclutter()

    return {
      Div = function(div)
        if _quarto.format.isTypstOutput() then
            local cod = quarto.utils.match(".cell/:child/.cell-output-display")(div)
            if cod then
                div.classes:extend({'quarto-scaffold'})
                cod.classes:extend({'quarto-scaffold'})
            end
        end
        return div
      end,
    }
  end