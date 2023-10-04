return {
  traverse = "topdown",

  Para = function(para)
    if #para.content == 1 and para.content[1].t == "RawInline" then
      -- don't emit RawInline in a para by itself, since that will cause a line break
      crash()
    end
  end
}
