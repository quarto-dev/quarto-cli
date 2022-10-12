function Div(el)
  if el.attr.classes:includes("example") then
    el.content:insert(pandoc.Header(3, {pandoc.Str("Example Div")}))
    return el
  end
end