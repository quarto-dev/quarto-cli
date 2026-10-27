-- theorems.lua
-- Shared Typst theorem/proof setup logic using theorion
-- Copyright (C) 2026 Posit Software, PBC

local typst_theorem_appearance_imported = false
local typst_theorem_like_frames = {}
local typst_simple_renderers = {}

local function appearance()
  local val = option("theorem-appearance", "simple")
  if type(val) == "table" then
    val = pandoc.utils.stringify(val)
  end
  return val or "simple"
end

local function ensure_appearance_imports()
  local val = appearance()
  if typst_theorem_appearance_imported then
    return val
  end

  typst_theorem_appearance_imported = true
  if val == "fancy" then
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
  elseif val == "clouds" then
    quarto.doc.include_text("in-header", [[
#import "@preview/theorion:0.4.1": make-frame, cosmos
#import cosmos.clouds: render-fn as clouds-render
]])
  elseif val == "rainbow" then
    quarto.doc.include_text("in-header", [[
#import "@preview/theorion:0.4.1": make-frame, cosmos
#import cosmos.rainbow: render-fn as rainbow-render
]])
  else
    quarto.doc.include_text("in-header", [[
#import "@preview/theorion:0.4.1": make-frame
]])
  end

  return val
end

-- Defines a simple renderer once. The "theorem" style writes a bold header and
-- an italic body; the "proof" style writes an italic header and an upright
-- body, with the name in brackets, as amsthm and the HTML output do.
local function ensure_simple_render(render_name, style)
  if typst_simple_renderers[render_name] then
    return
  end

  typst_simple_renderers[render_name] = true
  if style == "proof" then
    quarto.doc.include_text("in-header", "#let " .. render_name .. [[(prefix: none, title: "", full-title: auto, body) = {
  emph(prefix)
  if title != "" and title != none [ (#title)]
  [. ]
  body
  parbreak()
}
]])
    return
  end

  quarto.doc.include_text("in-header", "#let " .. render_name .. [[(prefix: none, title: "", full-title: auto, body) = {
  if full-title != "" and full-title != auto and full-title != none {
    strong[#full-title.]
    h(0.5em)
  }
  emph(body)
  parbreak()
}
]])
end

-- Writes text as a Typst string literal, so that titles from the language
-- files reach the page as written instead of being read as Typst markup.
local function typst_string(text)
  return '"' .. text:gsub("\\", "\\\\"):gsub('"', '\\"') .. '"'
end

-- Returns the `render:` argument of make-frame for the theorem appearance.
-- opts.color_scheme: fancy color set (primary, secondary or tertiary)
-- opts.color: clouds and rainbow fill color
-- opts.simple_render, opts.simple_style: name and style ("theorem" or "proof")
-- of the simple renderer
local function render_code(appearance_name, opts)
  if appearance_name == "fancy" then
    return "  render: fancy-box.with(\n" ..
      "    get-border-color: get-" .. opts.color_scheme .. "-border-color,\n" ..
      "    get-body-color: get-" .. opts.color_scheme .. "-body-color,\n" ..
      "    get-symbol: loc => none,\n" ..
      "  ),\n"
  elseif appearance_name == "clouds" then
    return "  render: clouds-render.with(fill: " .. opts.color .. ".lighten(85%)),\n"
  elseif appearance_name == "rainbow" then
    return "  render: rainbow-render.with(fill: " .. opts.color .. ".darken(20%)),\n"
  end
  ensure_simple_render(opts.simple_render, opts.simple_style)
  return "  render: " .. opts.simple_render .. ",\n"
end

-- Returns the Typst code for a frame header: bold, or plain for blocks whose
-- renderer styles the header itself.
local function header_code(title, bold)
  if bold then
    return 'text(weight: "bold", ' .. typst_string(title) .. ')'
  end
  return typst_string(title)
end

local function ensure_frame(env_name, title, render_arg, bold)
  if typst_theorem_like_frames[env_name] then
    return
  end

  typst_theorem_like_frames[env_name] = true
  quarto.doc.include_text("in-header", "#let (" .. env_name .. "-counter, " .. env_name .. "-box, " ..
    env_name .. ", show-" .. env_name .. ") = make-frame(\n" ..
    "  \"" .. env_name .. "\",\n" ..
    "  " .. header_code(title, bold) .. ",\n" ..
    "  inherited-levels: theorem-inherited-levels,\n" ..
    "  numbering: theorem-numbering,\n" ..
    render_arg ..
    ")")
  quarto.doc.include_text("in-header", "#show: show-" .. env_name)
end

-- Keeps the block's attributes, such as `style`, on a wrapper div, so the Typst
-- CSS support turns them into a block around the frame, as for other divs.
local function keep_attributes(frame, attributes)
  if #attributes > 0 then
    return pandoc.Div({frame}, pandoc.Attr("", {}, attributes))
  end
  return frame
end

return {
  ensure_appearance_imports = ensure_appearance_imports,
  ensure_frame = ensure_frame,
  header_code = header_code,
  keep_attributes = keep_attributes,
  render_code = render_code,
}
