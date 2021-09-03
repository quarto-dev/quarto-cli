-- engine-escape.lua
-- Copyright (C) 2021 by RStudio, PBC

local kEngineEscapePattern = "{({+([^}]+)}+)}"

function engineEscape()
  return {
    CodeBlock = function(el)

      -- handle code block with 'escaped' language engine
      if #el.attr.classes == 1 then
        local engine, lang = el.attr.classes[1]:match(kEngineEscapePattern)
        if engine then
          el.text = "```" .. engine .. "\n" .. el.text .. "\n" .. "```"
          el.attr.classes[1] = engineLang(lang)
          return el
        end
      end

      -- handle escaped engines within a code block
      el.text = el.text:gsub("```" .. kEngineEscapePattern, function(engine, lang)
        if #el.attr.classes == 0 or not isHighlightClass(#el.attr.classes[1]) then
          el.attr.classes:insert(1, engineLang(lang))
        end
        return "```" .. engine 
      end)
      return el
    end
  }
end

function engineLang(lang)
  lang = lang:match("^%w+")
  if lang == "r" or lang == "ojs" or lang == "js" or lang == "javascript" then
    return "java"
  else
    return lang
  end
end

local kHighlightClasses = pandoc.List:new({
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
})

function isHighlightClass(class)
  return kHighlightClasses:includes(class)
end