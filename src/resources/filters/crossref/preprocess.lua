-- preprocess.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- figures and tables support sub-references. mark them up before
-- we proceed with crawling for cross-refs
function crossref_mark_subfloats()
  return {
    traverse = "topdown",
    FloatRefTarget = function(float)
      float.content = _quarto.ast.walk(float.content, {
        FloatRefTarget = function(subfloat)
          subfloat.parent_id = float.identifier
          subfloat.content = _quarto.ast.walk(subfloat.content, {
            Image = function(image)
              image.attributes[kRefParent] = float.identifier
              return image
            end
          })
          return subfloat
        end
      })
      return float, false
    end
  }
end
