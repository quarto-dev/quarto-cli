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

