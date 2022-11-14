function emu_test(emulated)
  local native = quarto.ast.from_emulated(emulated)
  assert(pandoc.utils.stringify(native) == pandoc.utils.stringify(emulated))
  assert(type(emulated) == type(native))
end

return {
  Pandoc = function(doc)
    emu_test(pandoc.Str("Test"))
    emu_test(quarto.ast.to_emulated(quarto.ast.from_emulated(pandoc.Str("another"))))
    emu_test(pandoc.Inlines({"a", "b", "c"}))
    emu_test(pandoc.Blocks({pandoc.Plain(pandoc.Str("foo"))}))    
  end
}