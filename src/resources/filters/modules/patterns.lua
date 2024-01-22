-- patterns.lua
-- Copyright (C) 2023 Posit Software, PBC

-- helpers for working with patterns

local function tag(t)
  local pattern = "(<" .. t .. "[^>]*>)(.*)(</" .. t .. ">)"
  return pattern
end

local html_table_tag_name = "[Tt][Aa][Bb][Ll][Ee]"
local html_table = tag(html_table_tag_name)
local html_table_caption = tag("[Cc][Aa][Pp][Tt][Ii][Oo][Nn]")
local html_paged_table = "<script data[-]pagedtable[-]source type=\"application/json\">"
local html_gt_table = "<table class=\"gt_table\">"
local engine_escape = "{({+([^<}]+)}+)}"
local shortcode = "{{+<[^>]+>}+}"
local latex_label = "(\\label{([^}]+)})"
local latex_caption = "(\\caption{([^}]+)})"
local attr_identifier = "({#([^}]+)})"

-- this will catch two longtables in a single rawblock
-- but I'm willing to call that a bug in the source document
local latex_long_table = "(\\begin{longtable}.*\\end{longtable})" 
local latex_tabular = "(\\begin{tabular}.*\\end{tabular})"

-- note the capture pattern here is different because we need to capture the
-- body of the float environment as well as the environment itself
local latex_table = "(\\begin{table})(.*)(\\end{table})"
local latex_table_star = "(\\begin{table%*})(.*)(\\end{table%*})"

return {
  attr_identifier = attr_identifier,
  engine_escape = engine_escape,
  html_gt_table = html_gt_table,
  html_paged_table = html_paged_table,
  html_table_caption = html_table_caption,
  html_table_tag_name = html_table_tag_name,
  html_table = html_table,
  shortcode = shortcode,
  tag = tag,
  latex_label = latex_label,
  latex_caption = latex_caption,
  latex_long_table = latex_long_table,
  latex_tabular = latex_tabular,
  latex_table = latex_table,
  latex_table_star = latex_table_star,
}