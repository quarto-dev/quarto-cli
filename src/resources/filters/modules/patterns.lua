-- patterns.lua
-- Copyright (C) 2023 Posit Software, PBC

-- helpers for working with patterns

local function tag(t)
  local pattern = "(<" .. t .. "[^>]->)(.*)(</" .. t .. ">)"
  return pattern
end

local function start_tag(t)
  local pattern = "<" .. t .. "[^>]->"
  return pattern
end

local function end_tag(t)
  -- https://www.w3.org/html/wg/spec/syntax.html#end-tags
  local pattern = "</" .. t .. "%s*>"
  return pattern
end

local html_table_tag_name = "[Tt][Aa][Bb][Ll][Ee]"
local html_table = tag(html_table_tag_name)
local html_pre_tag_name = "[Pp][Rr][Ee]"
local html_pre_tag = tag(html_pre_tag_name)
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

local function combine_patterns(pattern_table)
  local combined_pattern = {}
  for i, v in ipairs(pattern_table) do
    table.insert(combined_pattern, "(" .. v .. ")")
  end
  return table.concat(combined_pattern)
end

-- see https://github.com/quarto-dev/quarto-cli/issues/9729#issuecomment-2122907870
-- for why this is necessary.
local function match_all_in_table(pattern_table)
  local function inner(text)
    for i, v in ipairs(pattern_table) do
      if text:match(v) == nil then
        return nil
      end
    end
    -- return the combined matches for the combined pattern
    return text:match(combine_patterns(pattern_table))
  end
  return inner
end

-- return the pattern, and matched content for the first pattern in the list that matches
local function match_in_list_of_patterns(raw_tex, list_of_patterns)
  for _, pattern in ipairs(list_of_patterns) do
    local matched =  { match_all_in_table(pattern)(raw_tex) }
    if matched and #matched > 0 then
      return matched, pattern
    end
  end
  return nil
end

return {
  attr_identifier = attr_identifier,
  engine_escape = engine_escape,
  html_gt_table = html_gt_table,
  html_paged_table = html_paged_table,
  html_table_caption = html_table_caption,
  html_table_tag_name = html_table_tag_name,

  html_start_tag = start_tag,
  html_end_tag = end_tag,

  -- this specific pattern sets us up to be able to parse a YAML
  -- comment block in the future.

  html_disable_table_processing_comment = "%<%!%-%-%| +quarto%-html%-table%-processing *: +none *%-%-%>",

  html_table = html_table,
  html_pre_tag = html_pre_tag,
  shortcode = shortcode,
  tag = tag,
  latex_label = latex_label,
  latex_caption = latex_caption,
  latex_long_table = latex_long_table,
  latex_tabular = latex_tabular,
  latex_table = latex_table,
  latex_table_star = latex_table_star,

  match_all_in_table = match_all_in_table,
  match_in_list_of_patterns = match_in_list_of_patterns,
  combine_patterns = combine_patterns
}