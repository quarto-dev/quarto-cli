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

  return t
end

local function break_quarto_md(src)
  local blocks = {}
  local lines = mysplit(src, "\n")
  local state = "markdown"
  local open_bracket_size = 0
  local md_indents = { 0 }
  local md_indents_size = 1

  local block = { }
  local state_map = {
    markdown = "markdown",
    indent_code = "code",
    code = "code",
    yaml = "yaml",
  }
  local function flush()
    if #block > 0 then
      table.insert(blocks, { type = state_map[state], value = table.concat(block, "\n") })
      block = {}
    end
  end
  local md_ul_context     = "^(%s+)([-*+]%s+)[^%s]+" -- from Blocks.hs in commonmark-hs, line 905
  local md_ol_context     = "^(%s+)([0-9]+%.%s+)[^%s]+"
  local handlers = {
    markdown = function(line)
      local current_indent = md_indents[md_indents_size]
      local indent, content = line:match("^(%s*)([^%s]*)")
      local ticks
      if content ~= nil then
        ticks = content:match("(`*)")
      end
      if indent == nil then
        indent = 0 -- in case line is empty
      else
        indent = indent:len()
      end

      local function update_indentation_context()
        if content == "" then
          -- we shouldn't pop context on lines with no text.
          return
        end

        -- check if we are in a new indentation context
        local ul_or_ol_indent_l, ul_or_ol_indent_r = line:match(md_ul_context)
        local maybe_new_context = false
        if ul_or_ol_indent_l == nil then
          ul_or_ol_indent_l, ul_or_ol_indent_r = line:match(md_ol_context)
        end

        if ul_or_ol_indent_l ~= nil then
          indent = ul_or_ol_indent_l:len() + ul_or_ol_indent_r:len()
          maybe_new_context = true
        end

        while indent < current_indent do
          md_indents_size = md_indents_size - 1
          current_indent = md_indents[md_indents_size]
        end

        if indent > current_indent and maybe_new_context then
          -- we are in a new indentation context
          md_indents_size = md_indents_size + 1
          md_indents[md_indents_size] = indent_size
        end
      end
      
      if state == "code" then
        if ticks ~= nil and ticks:len() >= open_bracket_size then
          -- this is the end of ticked code block, transition to 'markdown'
          table.insert(block, line)
          flush()
          state = "markdown"
          goto continue
        else
          goto continue_adding_line
        end
      end

      if state == "indent-code" then
        if indent < indent_size then
          -- this is the end of an indented code block, transition to 'markdown'
          flush()
          state = "markdown"
        end
        goto continue_adding_line
      end

      if state == "yaml" then
        if line:match("^%s*---") then
          -- this is the end of a YAML block, transition to 'markdown'
          table.insert(block, line)
          flush()
          state = "markdown"
        end
        goto continue
      end

      -- this is currently a markdown block

      if indent >= current_indent + 4 then
        -- we are switching to an indented code block
        flush()
        state = "indent-code"
        indent_size = indent
        goto continue_adding_line
      end

      if ticks:len() > 0 then
        -- this is a ticked code block
        flush()
        state = "code"
        open_bracket_size = ticks:len()
        goto continue_adding_line
      end

      if line:match("^(%s*)---") then
        flush()
        state = "yaml"
        goto continue_adding_line
      end

      update_indentation_context()

      ::continue_adding_line::
      table.insert(block, line)

      ::continue::
    end,
    indent_code = function(line)
      local m = line:match(indented_code)
      if m and m:len() >= indent_size then
        table.insert(block, line)
      else
        flush()
        state = "markdown"
      end
    end,
    code = function(line)
      local m = line:match("^%s*(````*)")
      table.insert(block, line)
      if m and m:len() >= open_bracket_size then
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
  quarto.utils.dump(blocks)
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
