function Table(t)
  if #t.colspecs ~= 2 then
    internal_error()
  end
  if t.colspecs[1][2] ~= 0.75 then
    internal_error()
  end
  if t.colspecs[2][2] ~= 0.25 then
    internal_error()
  end
end