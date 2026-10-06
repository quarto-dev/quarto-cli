-- Test helper: creates a fig-div with a single empty Para (no inlines)
-- and a fig-cap attribute for caption, triggering unguarded
-- content[1].content[1].t access in parsefiguredivs.lua:309
function Div(div)
  if div.identifier == "fig-empty-para" then
    div.content = pandoc.Blocks({pandoc.Para({})})
    div.attributes["fig-cap"] = "External caption"
    return div
  end
end
