-- breakquartomd.lua
-- currently called break.lua because breakquartomd.lua as a filename causes Lua to not import the module correctly!?
-- Copyright (C) 2020-2023 Posit Software, PBC

-- breaks quarto markdown into a sequence of "sections":
--   - "YAML" blocks
--   - non-code "markdown" blocks (this is not a Pandoc block, it's a contiguous section of Markdown)
--   - "Code blocks"


local module = {}

local function mysplit (inputstr, sep)
  local t = {}
  local i = 1
  local f = string.find(inputstr, sep, i)
  while f do
    table.insert(t, string.sub(inputstr, i, f - 1))
    i = f + 1
    f = string.find(inputstr, sep, i)
  end

  -- for str in string.find(inputstr, sep) do
  --   table.insert(t, str)
  -- end
  return t
end

local function break_quarto_md(src)
  local blocks = {}
  local lines = mysplit(src, "\n")
  local state = "markdown"
  local open_bracket_size = 0
  local block = {}
  local function flush()
    if #block > 0 then
      table.insert(blocks, { type = state, value = table.concat(block, "\n") })
      block = {}
    end
  end
  local handlers = {
    markdown = function(line)
      local m = line:match("^%s*(````*)")
      if m then
        flush()
        state = "code"
        open_bracket_size = m:len()
      elseif line:match("^%s*---") then
        flush()
        state = "yaml"
      end
      table.insert(block, line)
    end,
    code = function(line)
      local m = line:match("^%s*(````*)")
      table.insert(block, line)
      if m and m:len() == open_bracket_size then
        flush()
        state = "markdown"
      end
    end,
    yaml = function(line)
      table.insert(block, line)
      if line:match("^%s*---") then
        flush()
        state = "markdown"
      end
    end,
  }
  for _, line in ipairs(lines) do
    handlers[state](line)
  end
  flush()
  return blocks
end

module.break_quarto_md = break_quarto_md

return module

-- local test = [[
-- ---
-- format: html
-- ---

-- Some stuff here.

-- ```{some code}
-- Some code.
-- ```
-- ]]

-- p(break_quarto_md(test))
