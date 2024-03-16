-- astpipeline.lua
-- Copyright (C) 2023 Posit Software, PBC

function quarto_ast_pipeline()
  return {
    { name = "normalize-table-merge-raw-html", filter = table_merge_raw_html() },

    -- this filter can't be combined with others because it's top-down processing.
    -- unfortunate.
    { name = "normalize-html-table-processing", filter = parse_html_tables() },

    { name = "normalize-combined-1", filter = combineFilters({
        extract_latex_quartomarkdown_commands(),
        forward_cell_subcaps(),
        parse_extended_nodes(),
        code_filename(),
        normalize_fixup_data_uri_image_extension(),
      })
    },
    { 
      name = "normalize-combine-2", 
      filter = combineFilters({
        parse_md_in_html_rawblocks(),
        parse_floatreftargets(),
        parse_blockreftargets()
      }),
    },
    {
      name = "normalize-3",
      filter = handle_subfloatreftargets(),
    }
  }
end
