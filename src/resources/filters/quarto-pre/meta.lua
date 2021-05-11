-- meta.lua
-- Copyright (C) 2020 by RStudio, PBC

-- inject metadata
function quartoPreMetaInject()
  return {
    Meta = function(meta)

      -- injection awesomebox for captions, if needed
      if preState.hasCallouts and isLatexOutput() then
        metaInjectLatex(meta, function(inject)
          inject(
            usePackage("awesomebox")
          )
          inject(
            "\\definecolor{quarto-callout-color}{HTML}{20c997}\n" ..
            "\\definecolor{quarto-callout-note-color}{HTML}{4582ec}\n" ..
            "\\definecolor{quarto-callout-important-color}{HTML}{d9534f}\n" ..
            "\\definecolor{quarto-callout-warning-color}{HTML}{f0ad4e}\n" ..
            "\\definecolor{quarto-callout-tip-color}{HTML}{02b875}\n" ..
            "\\definecolor{quarto-callout-danger-color}{HTML}{fd7e14}\n"
          )
        end)
      end

      metaInjectLatex(meta, function(inject)
        if preState.usingTikz then
          inject(usePackage("tikz"))
        end
      end)
      return meta
    end
  }
end

