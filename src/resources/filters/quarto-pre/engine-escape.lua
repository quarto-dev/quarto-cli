-- engine-escape.lua
-- Copyright (C) 2021-2022 Posit Software, PBC

local patterns = require("modules/patterns")

function engine_escape()
  -- Line-by-line replacement for the pattern (\n?[^`\n]+`+){({+([^<}]+)}+)}
  -- which suffers from O(n^2) backtracking on long lines without backticks.
  -- See https://github.com/quarto-dev/quarto-cli/issues/14156
  -- Start-of-line fix for https://github.com/quarto-dev/quarto-cli/issues/14177
  --
  -- Two patterns for inline engine escape replacement:
  -- 1. Start-of-line: match 1-2 backticks only (inline code, not code fences)
  -- 2. Mid-line: match any backticks preceded by non-backtick text
  -- This avoids over-processing code fence patterns (```{{engine}}) produced by step 2.
  local sol_pattern = "^(``?)" .. patterns.engine_escape
  local mid_pattern = "([^`\n]+`+)" .. patterns.engine_escape
  local function unescape_inline_engine_codes(text)
    if not text:find("{{", 1, true) then
      return text
    end
    local result = {}
    local pos = 1
    local len = #text
    while pos <= len do
      local nl = text:find("\n", pos, true)
      local line
      if nl then
        line = text:sub(pos, nl)
        pos = nl + 1
      else
        line = text:sub(pos)
        pos = len + 1
      end
      if line:find("`", 1, true) and line:find("{{", 1, true) then
        line = line:gsub(sol_pattern, "%1%2")
        line = line:gsub(mid_pattern, "%1%2")
      end
      result[#result + 1] = line
    end
    return table.concat(result)
  end

  return {
    CodeBlock = function(el)

      -- handle code block with 'escaped' language engine
      if #el.attr.classes == 1 or #el.attr.classes == 2 and el.attr.classes[2] == 'code-annotation-code' then
        local engine, lang = el.attr.classes[1]:match(patterns.engine_escape)
        if engine then
          el.text = "```" .. engine .. "\n" .. el.text .. "\n" .. "```"
          el.attr.classes[1] = "markdown"
          return el
        end
      end

      -- handle escaped engines within a code block
      el.text = el.text:gsub("```" .. patterns.engine_escape, function(engine, lang)
        if #el.attr.classes == 0 or not isHighlightClass(el.attr.classes[1]) then
          el.attr.classes:insert(1, "markdown")
        end
        return "```" .. engine 
      end)

      -- handles escaped inline code cells within a code block
      el.text = unescape_inline_engine_codes(el.text)
      return el
    end,

    Code = function(el)
      -- don't accidentally process escaped shortcodes
      if el.text:match("^" .. patterns.shortcode) then
        return el
      end
      -- handle `{{python}} code`
      el.text = el.text:gsub("^" .. patterns.engine_escape, "%1")
      -- handles `` `{{python}} code` ``
      el.text = el.text:gsub("^(`+)" .. patterns.engine_escape, "%1%2")
      return el
    end
  }
end

-- FIXME these should be determined dynamically
local kHighlightClasses = {
  ["abc"] = true,
  ["actionscript"] = true,
  ["ada"] = true,
  ["agda"] = true,
  ["apache"] = true,
  ["asn1"] = true,
  ["asp"] = true,
  ["ats"] = true,
  ["awk"] = true,
  ["bash"] = true,
  ["bibtex"] = true,
  ["boo"] = true,
  ["c"] = true,
  ["changelog"] = true,
  ["clojure"] = true,
  ["cmake"] = true,
  ["coffee"] = true,
  ["coldfusion"] = true,
  ["comments"] = true,
  ["commonlisp"] = true,
  ["cpp"] = true,
  ["cs"] = true,
  ["css"] = true,
  ["curry"] = true,
  ["d"] = true,
  ["default"] = true,
  ["diff"] = true,
  ["djangotemplate"] = true,
  ["dockerfile"] = true,
  ["dot"] = true,
  ["doxygen"] = true,
  ["doxygenlua"] = true,
  ["dtd"] = true,
  ["eiffel"] = true,
  ["elixir"] = true,
  ["elm"] = true,
  ["email"] = true,
  ["erlang"] = true,
  ["fasm"] = true,
  ["fortranfixed"] = true,
  ["fortranfree"] = true,
  ["fsharp"] = true,
  ["gap"] = true,
  ["gcc"] = true,
  ["glsl"] = true,
  ["gnuassembler"] = true,
  ["go"] = true,
  ["graphql"] = true,
  ["groovy"] = true,
  ["hamlet"] = true,
  ["haskell"] = true,
  ["haxe"] = true,
  ["html"] = true,
  ["idris"] = true,
  ["ini"] = true,
  ["isocpp"] = true,
  ["j"] = true,
  ["java"] = true,
  ["javadoc"] = true,
  ["javascript"] = true,
  ["javascriptreact"] = true,
  ["json"] = true,
  ["jsp"] = true,
  ["julia"] = true,
  ["kotlin"] = true,
  ["latex"] = true,
  ["lex"] = true,
  ["lilypond"] = true,
  ["literatecurry"] = true,
  ["literatehaskell"] = true,
  ["llvm"] = true,
  ["lua"] = true,
  ["m4"] = true,
  ["makefile"] = true,
  ["mandoc"] = true,
  ["markdown"] = true,
  ["mathematica"] = true,
  ["matlab"] = true,
  ["maxima"] = true,
  ["mediawiki"] = true,
  ["metafont"] = true,
  ["mips"] = true,
  ["modelines"] = true,
  ["modula2"] = true,
  ["modula3"] = true,
  ["monobasic"] = true,
  ["mustache"] = true,
  ["nasm"] = true,
  ["nim"] = true,
  ["noweb"] = true,
  ["objectivec"] = true,
  ["objectivecpp"] = true,
  ["ocaml"] = true,
  ["octave"] = true,
  ["opencl"] = true,
  ["pascal"] = true,
  ["perl"] = true,
  ["php"] = true,
  ["pike"] = true,
  ["postscript"] = true,
  ["povray"] = true,
  ["powershell"] = true,
  ["prolog"] = true,
  ["protobuf"] = true,
  ["pure"] = true,
  ["purebasic"] = true,
  ["python"] = true,
  ["qml"] = true,
  ["r"] = true,
  ["raku"] = true,
  ["relaxng"] = true,
  ["relaxngcompact"] = true,
  ["rest"] = true,
  ["rhtml"] = true,
  ["roff"] = true,
  ["ruby"] = true,
  ["rust"] = true,
  ["scala"] = true,
  ["scheme"] = true,
  ["sci"] = true,
  ["sed"] = true,
  ["sgml"] = true,
  ["sml"] = true,
  ["spdxcomments"] = true,
  ["sql"] = true,
  ["sqlmysql"] = true,
  ["sqlpostgresql"] = true,
  ["stata"] = true,
  ["swift"] = true,
  ["tcl"] = true,
  ["tcsh"] = true,
  ["texinfo"] = true,
  ["toml"] = true,
  ["typescript"] = true,
  ["verilog"] = true,
  ["vhdl"] = true,
  ["xml"] = true,
  ["xorg"] = true,
  ["xslt"] = true,
  ["xul"] = true,
  ["yacc"] = true,
  ["yaml"] = true,
  ["zsh"] = true
}

function isHighlightClass(class)
  if kHighlightClasses[class] then return true else return false end
end