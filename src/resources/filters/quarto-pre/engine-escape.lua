-- engine-escape.lua
-- Copyright (C) 2021-2022 Posit Software, PBC

local patterns = require("modules/patterns")

function engine_escape()
  return {
    CodeBlock = function(el)

      -- handle code block with 'escaped' language engine
      if #el.attr.classes == 1 then
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
  "abc",
  "actionscript",
  "ada",
  "agda",
  "apache",
  "asn1",
  "asp",
  "ats",
  "awk",
  "bash",
  "bibtex",
  "boo",
  "c",
  "changelog",
  "clojure",
  "cmake",
  "coffee",
  "coldfusion",
  "comments",
  "commonlisp",
  "cpp",
  "cs",
  "css",
  "curry",
  "d",
  "default",
  "diff",
  "djangotemplate",
  "dockerfile",
  "dot",
  "doxygen",
  "doxygenlua",
  "dtd",
  "eiffel",
  "elixir",
  "elm",
  "email",
  "erlang",
  "fasm",
  "fortranfixed",
  "fortranfree",
  "fsharp",
  "gcc",
  "glsl",
  "gnuassembler",
  "go",
  "graphql",
  "groovy",
  "hamlet",
  "haskell",
  "haxe",
  "html",
  "idris",
  "ini",
  "isocpp",
  "j",
  "java",
  "javadoc",
  "javascript",
  "javascriptreact",
  "json",
  "jsp",
  "julia",
  "kotlin",
  "latex",
  "lex",
  "lilypond",
  "literatecurry",
  "literatehaskell",
  "llvm",
  "lua",
  "m4",
  "makefile",
  "mandoc",
  "markdown",
  "mathematica",
  "matlab",
  "maxima",
  "mediawiki",
  "metafont",
  "mips",
  "modelines",
  "modula2",
  "modula3",
  "monobasic",
  "mustache",
  "nasm",
  "nim",
  "noweb",
  "objectivec",
  "objectivecpp",
  "ocaml",
  "octave",
  "opencl",
  "pascal",
  "perl",
  "php",
  "pike",
  "postscript",
  "povray",
  "powershell",
  "prolog",
  "protobuf",
  "pure",
  "purebasic",
  "python",
  "qml",
  "r",
  "raku",
  "relaxng",
  "relaxngcompact",
  "rest",
  "rhtml",
  "roff",
  "ruby",
  "rust",
  "scala",
  "scheme",
  "sci",
  "sed",
  "sgml",
  "sml",
  "spdxcomments",
  "sql",
  "sqlmysql",
  "sqlpostgresql",
  "stata",
  "swift",
  "tcl",
  "tcsh",
  "texinfo",
  "toml",
  "typescript",
  "verilog",
  "vhdl",
  "xml",
  "xorg",
  "xslt",
  "xul",
  "yacc",
  "yaml",
  "zsh"
}

function isHighlightClass(class)
  for _, v in ipairs (kHighlightClasses) do
    if v == class then
      return true
    end
  end
  return false
end