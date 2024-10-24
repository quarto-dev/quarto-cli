-- astpipeline.lua
-- Copyright (C) 2023 Posit Software, PBC

function quarto_ast_pipeline()
  local function warn_on_stray_triple_colons()
    local function block_handler(block)
      _quarto.ast.walk(block, {
        Str = function(el)
          if string.match(el.text, ":::(:*)") then 
            local error_message = 
              "\nThe following string was found in the document: " .. el.text .. 
              "\nThis string was found in a block element with the following content:\n\n" .. pandoc.utils.stringify(block) .. 
              "\n\nThis usually indicates a problem with a fenced div in the document. Please check the document for errors."
            warn(error_message)
          end
        end
      })
  end
    return {
      Para = block_handler,
      Plain = block_handler,
    }
  end
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
        warn_on_stray_triple_colons(),
      }),
      force_pandoc_walk = true,
    },
    { 
      name = "normalize-combine-2", 
      filter = combineFilters({
        parse_md_in_html_rawblocks(),
        parse_floatreftargets(),
        parse_blockreftargets()
      }),
      force_pandoc_walk = true,
    },
    {
      name = "normalize-3",
      filter = handle_subfloatreftargets(),
    }
  }
end
