local codeBlock = require('docusaurus_utils').codeBlock

-- print("Found me")
-- _quarto.ast.add_renderer("Callout", function()
--   return we_are_docusaurus -- detect docusaurus-md
-- end, function(node)
--   local admonition = pandoc.List()
--   admonition:insert(pandoc.RawBlock("markdown", "\n:::" .. node.type))
--   if node.title then
--     admonition:insert(pandoc.Header(2, node.title))
--   end
--   local content = node.content
--   if type(content) == "table" then
--     admonition:extend(content)
--   else
--     admonition:insert(content)
--   end
--   admonition:insert(pandoc.RawBlock("markdown", ":::\n"))
--   return admonition
-- end)

-- luacov: disable
return {} -- return an empty table as a hack to pretend we're a shortcode handler for now
-- luacov: enable