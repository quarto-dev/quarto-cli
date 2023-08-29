-- figures.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

-- process all figures
function crossref_figures()
  return {
    -- process a float
    -- adding it to the global index of floats (figures, tables, etc)
    --
    -- in 1.4, we won't re-write its caption here, but instead we'll
    -- do it at the render filter.

    FloatRefTarget = function(float)
      -- if figure is unlabeled, do not process
      if is_unlabeled_float(float) then
        return nil
      end

      -- get label and base caption
      -- local label = el.attr.identifier
      local kind = refType(float.identifier)
      if kind == nil then
        warn("Could not determine float type for " .. float.identifier)
        return nil
      end
    
      -- determine order, parent, and displayed caption
      local order
      local parent = float.parent_id
      if (parent) then
        order = nextSubrefOrder()
      else
        order = indexNextOrder(kind)
      end
    
      float.order = order
      -- update the index
      indexAddEntry(float.identifier, parent, order, {float.caption_long})
      return float
    end
  }
end

