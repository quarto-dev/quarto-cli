-- configurefilters.lua
-- Determine which filter chains will be active

function configureFilters()
  return {
    Meta = function(meta)
      preState.active_filters = param("active-filters")
    end
  }
end