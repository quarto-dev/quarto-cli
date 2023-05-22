-- configurefilters.lua
-- Determine which filter chains will be active

function configure_filters()
  return {
    Meta = function(meta)
      quarto_global_state.active_filters = param("active-filters")
    end
  }
end