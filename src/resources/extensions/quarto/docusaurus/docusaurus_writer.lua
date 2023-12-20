-- docusaurus_writer.lua
-- Copyright (C) 2020-2023 Posit Software, PBC

-- function Writer(doc, opts)
--   doc = quarto._quarto.ast.walk(doc, {
--     CodeBlock = code_block,
--   })
--   assert(doc ~= nil)

--   -- insert react preamble if we have it
--   if #reactPreamble > 0 then
--     local preamble = table.concat(reactPreamble, "\n")
--     doc.blocks:insert(1, pandoc.RawBlock("markdown", preamble .. "\n"))
--   end

--   local extensions = {
--     yaml_metadata_block = true,
--     pipe_tables = true,
--     footnotes = true,
--     tex_math_dollars = true,
--     header_attributes = true,
--     raw_html = true,
--     all_symbols_escapable = true,
--     backtick_code_blocks = true,
--     fenced_code_blocks = true,
--     space_in_atx_header = true,
--     intraword_underscores = true,
--     lists_without_preceding_blankline = true,
--     shortcut_reference_links = true,
--   }

--   return pandoc.write(doc, {
--     format = 'markdown_strict',
--     extensions = extensions
--   }, opts)
-- end
