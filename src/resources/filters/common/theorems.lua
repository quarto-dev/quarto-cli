-- theorems.lua
-- Copyright (C) 2020-2022 Posit Software, PBC

local typst_theorem_appearance_imported = false
local typst_theorem_like_frames = {}
local typst_simple_renderers = {}

function theoremTypstAppearance()
  local appearance = option("theorem-appearance", "simple")
  if type(appearance) == "table" then
    appearance = pandoc.utils.stringify(appearance)
  end
  return appearance or "simple"
end

function ensureTheoremTypstAppearanceImports()
  local appearance = theoremTypstAppearance()
  if typst_theorem_appearance_imported then
    return appearance
  end

  typst_theorem_appearance_imported = true
  if appearance == "fancy" then
    quarto.doc.include_text("in-header", [[
#import "@preview/theorion:0.4.1": make-frame, cosmos
#import cosmos.fancy: fancy-box, set-primary-border-color, set-primary-body-color, set-secondary-border-color, set-secondary-body-color, set-tertiary-border-color, set-tertiary-body-color, get-primary-border-color, get-primary-body-color, get-secondary-border-color, get-secondary-body-color, get-tertiary-border-color, get-tertiary-body-color
]])
    quarto.doc.include_text("before-body", [[
#set-primary-border-color(brand-color.at("primary", default: green.darken(30%)))
#set-primary-body-color(brand-color.at("primary", default: green).lighten(90%))
#set-secondary-border-color(brand-color.at("secondary", default: orange))
#set-secondary-body-color(brand-color.at("secondary", default: orange).lighten(90%))
#set-tertiary-border-color(brand-color.at("tertiary", default: blue.darken(30%)))
#set-tertiary-body-color(brand-color.at("tertiary", default: blue).lighten(90%))
]])
  elseif appearance == "clouds" then
    quarto.doc.include_text("in-header", [[
#import "@preview/theorion:0.4.1": make-frame, cosmos
#import cosmos.clouds: render-fn as clouds-render
]])
  elseif appearance == "rainbow" then
    quarto.doc.include_text("in-header", [[
#import "@preview/theorion:0.4.1": make-frame, cosmos
#import cosmos.rainbow: render-fn as rainbow-render
]])
  else
    quarto.doc.include_text("in-header", [[
#import "@preview/theorion:0.4.1": make-frame
]])
  end

  return appearance
end

function ensureTheoremTypstSimpleRender(render_name, italic_body)
  if typst_simple_renderers[render_name] then
    return
  end

  typst_simple_renderers[render_name] = true
  local body_render = "body"
  if italic_body then
    body_render = "emph(body)"
  end

  quarto.doc.include_text("in-header", "#let " .. render_name .. [[(prefix: none, title: "", full-title: auto, body) = {
  if full-title != "" and full-title != auto and full-title != none {
    strong[#full-title.]
    h(0.5em)
  }
  ]] .. body_render .. "\n" .. [[
  parbreak()
}
]])
end

function ensureTheoremTypstFrame(env_name, title, render_code)
  if typst_theorem_like_frames[env_name] then
    return false
  end

  typst_theorem_like_frames[env_name] = true
  quarto.doc.include_text("in-header", "#let (" .. env_name .. "-counter, " .. env_name .. "-box, " ..
    env_name .. ", show-" .. env_name .. ") = make-frame(\n" ..
    "  \"" .. env_name .. "\",\n" ..
    "  text(weight: \"bold\")[" .. title .. "],\n" ..
    "  inherited-levels: theorem-inherited-levels,\n" ..
    "  numbering: theorem-numbering,\n" ..
    render_code ..
    ")")
  quarto.doc.include_text("in-header", "#show: show-" .. env_name)
  return true
end
