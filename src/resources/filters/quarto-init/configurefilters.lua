-- configurefilters.lua
-- Determine which filter chains will be active

function configure_filters()
  return {
    Meta = function(meta)
      preState.active_filters = param("active-filters")
    end
  }
end