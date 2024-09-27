-- pandoc-tables.lua
-- Copyright (C) 2024 Posit Software, PBC

-- Add back classes 'odd', (or 'header' in table header) / 'even' to table rows
-- They were removed in pandoc 3.2.1 but are useful for styling pandoc processed tables
-- Quarto detects .odd class 
function pandoc_tables()
  local function add_odd_even (rows, odd)
    odd = odd or 'odd'
    for rownum, row in ipairs(rows) do
      row.classes:insert((rownum % 2) == 0 and 'even' or odd)
    end
    return rows
  end

  return {
    Table = function (tbl)
      add_odd_even(tbl.head.rows, 'header')
      for _, tblbody in ipairs(tbl.bodies) do
        add_odd_even(tblbody.body)
      end
      add_odd_even(tbl.foot.rows)
      return tbl
    end
  }
end