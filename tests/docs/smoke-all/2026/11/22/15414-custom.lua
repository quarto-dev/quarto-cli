local definitions = {
  exercise = { title = "Exercise", color = "800080" },
  answer = { title = "Answer", color = "2e7d32", appearance = "minimal" },
}

function Div(div)
  for _, class in ipairs(div.classes) do
    local definition = definitions[class]
    if definition then
      local callout = quarto.Callout({
        type = class,
        title = definition.title,
        appearance = definition.appearance,
        content = div.content,
      })
      local color = 'rgb("#' .. definition.color .. '")'
      return {
        pandoc.RawBlock("typst", "#[\n#let extension-callout = callout\n#let callout(..args) = extension-callout(..args, background_color: " .. color .. ".lighten(87%), icon_color: " .. color .. ")"),
        callout,
        pandoc.RawBlock("typst", "]"),
      }
    end
  end
end
