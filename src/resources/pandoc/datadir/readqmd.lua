-- read qmd with quarto syntax extensions and produce quarto's extended AST
-- Copyright (C) 2023-2024 Posit Software, PBC
--
-- Originally by Albert Krewinkel

local md_shortcode = require("lpegshortcode")
local md_fenced_div = require("lpegfenceddiv")

-- Support the same format extensions as pandoc's Markdown reader
Extensions = pandoc.format.extensions 'markdown'

-- we replace invalid tags with random strings of the same size
-- to safely allow code blocks inside pipe tables
-- note that we can't use uppercase letters here
-- because pandoc canonicalizes classes to lowercase.
local function random_string(size)
  local chars = "abcdefghijklmnopqrstuvwxyz"
  local lst = {}
  for _ = 1,size do
    local ix = math.random(1, #chars)
    table.insert(lst, string.sub(chars, ix, ix))
  end
  return table.concat(lst, "")
end

local function find_invalid_tags(str)
  -- [^.=\n]
  --   we disallow "." to avoid catching {.python}
  --   we disallow "=" to avoid catching {foo="bar"}
  --   we disallow "\n" to avoid multiple lines

  -- no | in lua patterns...

  -- (c standard, 7.4.1.10, isspace function)
  -- %s catches \n and \r, so we must use [ \t\f\v] instead

  local patterns = {
    "^[ \t\f\v]*(```+[ \t\f\v]*)(%{+[^.=\n\r]*%}+)", 
    "\n[ \t\f\v]*(```+[ \t\f\v]*)(%{+[^.=\n\r]+%}+)"
  }
  local function find_it(init)
    for _, pattern in ipairs(patterns) do
      local range_start, range_end, ticks, tag = str:find(pattern, init)
      if range_start ~= nil then
        return range_start, range_end, ticks, tag
      end
    end
    return nil
  end

  local init = 1
  local range_start, range_end, ticks, tag = find_it(init)
  local tag_set = {}
  local tags = {}
  while tag ~= nil do
    init = range_end + 1
    if not tag_set[tag] then
      tag_set[tag] = true
      table.insert(tags, tag)
    end
    range_start, range_end, ticks, tag = find_it(init)
  end
  return tags
end

local function escape_invalid_tags(str) 
  local tags = find_invalid_tags(str)
  -- we must now replace the tags in a careful order. Specifically,
  -- we can't replace a key that's a substring of a larger key without
  -- first replacing the larger key.
  --
  -- ie. if we replace {python} before {{python}}, Bad Things Happen.
  -- so we sort the tags by descending size, which suffices
  table.sort(tags, function(a, b) return #b < #a end)

  local replacements = {}
  for _, k in ipairs(tags) do
    local replacement
    local attempts = 1
    repeat
      replacement = random_string(#k)
      attempts = attempts + 1
    until str:find(replacement, 1, true) == nil or attempts == 100
    if attempts == 100 then
      -- luacov: disable
      print("Internal error, could not find safe replacement for "..k.." after 100 tries")
      print("Please file a bug at https://github.com/quarto-dev/quarto-cli")
      os.exit(1)
      -- luacov: enable
    end
    -- replace all lua special pattern characters with their
    -- escaped versions
    local safe_pattern = k:gsub("([%^%$%(%)%%%.%[%]%*%+%-%?])", "%%%1")
    replacements[replacement] = k
    local patterns = {
      "^([ \t\f\v]*```+[ \t\f\v]*)" .. safe_pattern,
      "(\n[ \t\f\v]*```+[ \t\f\v]*)" .. safe_pattern
    }

    str = str:gsub(patterns[1], "%1" .. replacement):gsub(patterns[2], "%1" .. replacement)
  end
  return str, replacements
end

local function unescape_invalid_tags(str, tags)
  for replacement, k in pairs(tags) do
    -- replace all lua special replacement characters with their
    -- escaped versions, so that when we restore the behavior,
    -- we don't accidentally create a pattern
    local result = k:gsub("([$%%])", "%%%1")
    str = str:gsub(replacement, result)
  end
  return str
end

-- Convert a hexadecimal string back to the original string
local function hex_to_string(hex)
    return (hex:gsub('..', function(cc)
        return string.char(tonumber(cc, 16))
    end))
end

local function readqmd(txt, opts)
  local uuid_pattern = "b58fc729%-690b%-4000%-b19f%-365a4093b2ff%-([A-Fa-f0-9]+)%-"
  local tags
  txt = md_fenced_div.attempt_to_fix_fenced_div(txt)
  txt, tags = escape_invalid_tags(txt)
  txt = md_shortcode.parse_md_shortcode_2(txt)
  local flavor = {
    format = "markdown",
    extensions = {},
  }
  if param("user-defined-from") then
    flavor = _quarto.format.parse_format(param("user-defined-from"))
  else 
    for k, v in pairs(opts.extensions) do
      flavor.extensions[v] = true
    end
  end

  -- ### Opt-out some extensions that we know we won't support for now ###
  -- https://pandoc.org/MANUAL.html#extension-table_attributes
  -- https://github.com/quarto-dev/quarto-cli/pull/13249#issuecomment-3715267414
  flavor.extensions["table_attributes"] = false

  -- Format flavor, i.e., which extensions should be enabled/disabled.
  local function restore_invalid_tags(tag)
    return tags[tag] or tag
  end

  -- parse_shortcode overparses shortcodes inside code blocks, link targets, etc.
  -- so we need to undo that damage here

  local unshortcode_text = function (c)
    c.text = c.text:gsub(uuid_pattern, hex_to_string)
    return c
  end

  local function filter_attrs(el)
    for k,v in pairs(el.attributes) do
      if type(v) == "string" then
        local new_str = v:gsub(uuid_pattern, hex_to_string)
        -- we avoid always assigning to slightly workaround 
        -- what appears to be a foundational problem with Pandoc's Lua API
        -- while accessing attributes with repeated keys.
        -- Quarto is still going to be broken for the case
        -- where there are shortcodes inside values of attributes with
        -- repeated keys:
        --
        -- []{k='{{< meta k1 >}}' k='{{< meta k2 >}}'}
        --
        -- But I don't know how to work around this.
        if new_str ~= v then
          el.attributes[k] = new_str
        end
      end
    end
    return el
  end

  local doc = pandoc.read(txt or "", flavor, opts):walk {
    CodeBlock = function (cb)
      cb.classes = cb.classes:map(restore_invalid_tags)
      cb.text = cb.text:gsub(uuid_pattern, hex_to_string)
      cb.text = unescape_invalid_tags(cb.text, tags)
      return cb
    end,
    Code = unshortcode_text,
    RawInline = unshortcode_text,
    RawBlock = unshortcode_text,
    Header = filter_attrs,
    Span = filter_attrs,
    Div = filter_attrs,
    Link = function (l)
      l = filter_attrs(l)
      l.target = l.target:gsub(uuid_pattern, hex_to_string)
      return l
    end,
    Image = function (i)
      i = filter_attrs(i)
      -- Replace UUID-encoded shortcodes in i.src
      i.src = i.src:gsub(uuid_pattern, hex_to_string)
      return i
    end,
    Str = function(str_node)
      local str = str_node.text
      -- Quick check: if UUID not present at all, return as-is
      if not str:find("b58fc729-690b-4000-b19f-365a4093b2ff", 1, true) then
        return nil
      end

      local result = pandoc.Inlines{}
      local pos = 1

      while true do
        local match_start, match_end, hex_content = str:find(uuid_pattern, pos)

        if not match_start then
          -- No more matches; append remaining string if any
          if pos <= #str then
            table.insert(result, pandoc.Str(str:sub(pos)))
          end
          break
        end

        -- Append prefix before the match as a Str node (if non-empty)
        if match_start > pos then
          table.insert(result, pandoc.Str(str:sub(pos, match_start - 1)))
        end

        -- Convert hex to original shortcode string
        local shortcode_text = hex_to_string(hex_content)

        -- Parse the shortcode to markdown span syntax
        local parsed_md = md_shortcode.parse_md_shortcode(shortcode_text) or ""

        -- Convert to Pandoc inlines via pandoc.read
        local doc = pandoc.read(parsed_md, "markdown")
        local inlines = doc.blocks[1] and doc.blocks[1].content or pandoc.Inlines{}
        -- Append the inlines to result
        for _, inline in ipairs(inlines) do
          table.insert(result, inline)
        end

        -- Move position past the match
        pos = match_end + 1
      end

      return result
    end
  }
  return doc
end

local reader_option_keys = {
  "abbreviations",
  "columns",
  "default_image_extension",
  "extensions",
  "indented_code_classes",
  "standalone",
  "strip_comments",
  "tab_stops",
  "track_changes",
}

local function options_to_meta(opts)
  local result = {}
  for _, key in ipairs(reader_option_keys) do
    result[key] = opts[key]
  end
  return result
end

local function meta_to_options(meta)
  local result = {}
  for _, key in ipairs(reader_option_keys) do
    result[key] = meta[key]
  end
  return pandoc.ReaderOptions(result)
end

return {
  readqmd = readqmd,
  options_to_meta = options_to_meta,
  meta_to_options = meta_to_options
}
