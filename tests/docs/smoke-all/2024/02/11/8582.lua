local count = 0
function Table(tbl)
  count = count + 1
end
function Header(heading)
  -- should never parse this heading in Pandoc
  assert(heading.level ~= 4)
end
function Pandoc(doc)
  assert(count == 3)
end