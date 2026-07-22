-- Test helper: empties Figure content to trigger unguarded .content[1].t access
function Figure(fig)
  if fig.identifier == "fig-emptied" then
    fig.content = pandoc.Blocks({})
    return fig
  end
end
