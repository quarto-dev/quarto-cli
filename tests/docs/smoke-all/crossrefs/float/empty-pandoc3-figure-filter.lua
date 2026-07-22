-- Test helper: empties non-crossref Figure content to trigger
-- unguarded .content[1].t access in pandoc3_figure.lua
function Figure(fig)
  if fig.identifier == "" then
    fig.content = pandoc.Blocks({})
    return fig
  end
end
