-- astpipeline.lua
-- Copyright (C) 2023 Posit Software, PBC

function quarto_ast_pipeline()
  return {
    { name = "normalize-table-merge-raw-html", filter = table_merge_raw_html() },
    
    { name = "normalize-combined-1", filter = combineFilters({
        parse_html_tables(),
        parse_extended_nodes(),
        code_filename(),
        normalize_fixup_data_uri_image_extension(),
      })
    },
    { 
      name = "normalize-combine-2", 
      filter = combineFilters({
        parse_md_in_html_rawblocks(),
        parse_floats(),
      }),
    },
  }
end
