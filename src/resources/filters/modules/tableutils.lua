return {
  all_cells = function (tbl)
    return coroutine.wrap(function()
      -- head rows
      for _, row in ipairs(tbl.head.rows) do
        for _, cell in ipairs(row.cells) do
          coroutine.yield(cell)
        end
      end
      -- body sections
      for _, body in ipairs(tbl.bodies) do
        -- intermediate head rows
        for _, row in ipairs(body.head) do
          for _, cell in ipairs(row.cells) do
            coroutine.yield(cell)
          end
        end
        -- body rows
        for _, row in ipairs(body.body) do
          for _, cell in ipairs(row.cells) do
            coroutine.yield(cell)
          end
        end
      end
      -- foot rows
      for _, row in ipairs(tbl.foot.rows) do
        for _, cell in ipairs(row.cells) do
          coroutine.yield(cell)
        end
      end
    end)
  end
}