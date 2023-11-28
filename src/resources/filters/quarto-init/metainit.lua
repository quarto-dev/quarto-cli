-- metainit.lua
-- All initialization functions that require access to metadata

function quarto_meta_init()
  return {
    Meta = function(meta)
      configure_filters()
      read_includes(meta)
      init_crossref_options(meta)
      initialize_custom_crossref_categories(meta)
    end
  }
end