function Pandoc(doc)
  local is_empty = quarto.utils.is_empty_node

  -- nil is empty
  assert(is_empty(nil) == true, "nil should be empty")

  -- text nodes: Str
  assert(is_empty(pandoc.Str("")) == true, "Str('') should be empty")
  assert(is_empty(pandoc.Str("hello")) == false, "Str('hello') should not be empty")

  -- text nodes: Code
  assert(is_empty(pandoc.Code("")) == true, "Code('') should be empty")
  assert(is_empty(pandoc.Code("x")) == false, "Code('x') should not be empty")

  -- text nodes: RawInline
  assert(is_empty(pandoc.RawInline("html", "")) == true, "RawInline('') should be empty")
  assert(is_empty(pandoc.RawInline("html", "<br>")) == false, "RawInline('<br>') should not be empty")

  -- container nodes: empty vs non-empty
  assert(is_empty(pandoc.Para({})) == true, "Para({}) should be empty")
  assert(is_empty(pandoc.Para({pandoc.Str("hi")})) == false, "Para with content should not be empty")

  -- empty table
  assert(is_empty({}) == true, "empty table should be empty")
  assert(is_empty({1}) == false, "non-empty table should not be empty")
end
