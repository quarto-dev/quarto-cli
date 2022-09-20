
return {
  {
    ---@param elem pandoc.Div
    Div = function (elem)
      if elem.attr.classes:includes("callout") then
        error("THERE WAS A PROCESSED CALLOUT!\nIf the filter order is correct, this should not happen.")
      end
    end,
  }
}