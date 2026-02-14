-- theorem.lua
-- custom AST node for theorems, lemmata, etc.
-- 
-- Copyright (C) 2023 Posit Software, PBC

-- available theorem types
theorem_types = {
  thm = {
    env = "theorem",
    style = "plain",
    title = "Theorem"
  },
  lem = {
    env = "lemma",
    style = "plain",
    title = "Lemma"
  },
  cor = {
    env = "corollary",
    style = "plain",
    title = "Corollary",
  },
  prp = {
    env = "proposition",
    style = "plain",
    title = "Proposition",
  },
  cnj = {
    env = "conjecture",
    style = "plain",
    title = "Conjecture"
  },
  def = {
    env = "definition",
    style = "definition",
    title = "Definition",
  },
  exm = {
    env = "example",
    style = "definition",
    title = "Example",
  },
  exr = {
    env = "exercise",
    style = "definition",
    title = "Exercise"
  },
  alg = {
    env = "algorithm",
    style = "plain",
    title = "Algorithm"
  },
  axm = {
    env = "axiom",
    style = "definition",
    title = "Axiom"
  },
  asp = {
    env = "assumption",
    style = "definition",
    title = "Assumption"
  },
}

function has_theorem_ref(el)
  local type = refType(el.attr.identifier)
  return theorem_types[type] ~= nil
end

function is_theorem_div(div)
  return is_regular_node(div, "Div") and has_theorem_ref(div)
end

_quarto.ast.add_handler({

  -- empty table so this handler is only called programmatically
  class_name = {},

  -- the name of the ast node, used as a key in extended ast filter tables
  ast_name = "Theorem",

  -- generic names this custom AST node responds to
  -- this is still unimplemented
  interfaces = {"Crossref"},

  -- Theorems are always blocks
  kind = "Block",

  parse = function(div)
    -- luacov: disable
    internal_error()
    -- luacov: enable
  end,

  slots = { "div", "name" },

  constructor = function(tbl)
    return {
      name = tbl.name,
      div = tbl.div,
      identifier = tbl.identifier
    }
  end
})

-- Get theorem-appearance option (simple, fancy, clouds, rainbow)
local function get_theorem_appearance()
  local appearance = option("theorem-appearance", "simple")
  if appearance ~= nil and type(appearance) == "table" then
    appearance = pandoc.utils.stringify(appearance)
  end
  return appearance or "simple"
end

-- Color mapping for clouds/rainbow themes (per theorem type)
local theme_colors = {
  thm = "red", lem = "teal", cor = "navy", prp = "blue",
  cnj = "navy", def = "olive", exm = "green", exr = "purple", alg = "maroon"
}

local included_typst_theorems = false
local letted_typst_theorem = {}
local function ensure_typst_theorems(reftype)
  local appearance = get_theorem_appearance()

  if not included_typst_theorems then
    included_typst_theorems = true

    if appearance == "fancy" then
      -- Import theorion's make-frame and fancy-box theming
      quarto.doc.include_text("in-header", [[
#import "@preview/theorion:0.4.1": make-frame, cosmos
#import cosmos.fancy: fancy-box, set-primary-border-color, set-primary-body-color, set-secondary-border-color, set-secondary-body-color, set-tertiary-border-color, set-tertiary-body-color, get-primary-border-color, get-primary-body-color, get-secondary-border-color, get-secondary-body-color, get-tertiary-border-color, get-tertiary-body-color
]])
      -- Set theorem colors from brand-color (runs in before-body, after brand-color is defined)
      quarto.doc.include_text("before-body", [[
#set-primary-border-color(brand-color.at("primary", default: green.darken(30%)))
#set-primary-body-color(brand-color.at("primary", default: green).lighten(90%))
#set-secondary-border-color(brand-color.at("secondary", default: orange))
#set-secondary-body-color(brand-color.at("secondary", default: orange).lighten(90%))
#set-tertiary-border-color(brand-color.at("tertiary", default: blue.darken(30%)))
#set-tertiary-body-color(brand-color.at("tertiary", default: blue).lighten(90%))
]])
    elseif appearance == "clouds" then
      -- Import theorion's make-frame and clouds render function
      quarto.doc.include_text("in-header", [[
#import "@preview/theorion:0.4.1": make-frame, cosmos
#import cosmos.clouds: render-fn as clouds-render
]])
    elseif appearance == "rainbow" then
      -- Import theorion's make-frame and rainbow render function
      quarto.doc.include_text("in-header", [[
#import "@preview/theorion:0.4.1": make-frame, cosmos
#import cosmos.rainbow: render-fn as rainbow-render
]])
    else -- simple (default)
      -- Import only make-frame and define simple render function
      quarto.doc.include_text("in-header", [[
#import "@preview/theorion:0.4.1": make-frame

// Simple theorem render: bold title with period, italic body
#let simple-theorem-render(prefix: none, title: "", full-title: auto, body) = {
  if full-title != "" and full-title != auto and full-title != none {
    strong[#full-title.]
    h(0.5em)
  }
  emph(body)
  parbreak()
}
]])
    end
  end

  if not letted_typst_theorem[reftype] then
    letted_typst_theorem[reftype] = true
    local theorem_type = theorem_types[reftype]
    local title = titleString(reftype, theorem_type.title)

    -- Build render code based on appearance
    local render_code
    if appearance == "fancy" then
      -- Map theorem styles to color schemes (primary=definitions, secondary=theorems, tertiary=propositions)
      local color_scheme = "secondary" -- default for most theorem types
      if theorem_type.style == "definition" then
        color_scheme = "primary"
      elseif reftype == "prp" then
        color_scheme = "tertiary"
      end
      render_code = "  render: fancy-box.with(\n" ..
        "    get-border-color: get-" .. color_scheme .. "-border-color,\n" ..
        "    get-body-color: get-" .. color_scheme .. "-body-color,\n" ..
        "    get-symbol: loc => none,\n" ..
        "  ),\n"
    elseif appearance == "clouds" then
      local color = theme_colors[reftype] or "gray"
      render_code = "  render: clouds-render.with(fill: " .. color .. ".lighten(85%)),\n"
    elseif appearance == "rainbow" then
      local color = theme_colors[reftype] or "gray"
      render_code = "  render: rainbow-render.with(fill: " .. color .. ".darken(20%)),\n"
    else -- simple
      render_code = "  render: simple-theorem-render,\n"
    end

    -- Use theorion's make-frame with appropriate render
    quarto.doc.include_text("in-header", "#let (" .. theorem_type.env .. "-counter, " .. theorem_type.env .. "-box, " ..
      theorem_type.env .. ", show-" .. theorem_type.env .. ") = make-frame(\n" ..
      "  \"" .. theorem_type.env .. "\",\n" ..
      "  text(weight: \"bold\")[" .. title .. "],\n" ..
      "  inherited-levels: theorem-inherited-levels,\n" ..
      "  numbering: theorem-numbering,\n" ..
      render_code ..
      ")")
    quarto.doc.include_text("in-header", "#show: show-" .. theorem_type.env)
  end
end


_quarto.ast.add_renderer("Theorem", function()
  return true 
end, function(thm)
  local el = thm.div
  local pt = pandoc.utils.type(el)
  if pt == "Blocks" or el.t ~= "Div" then
    el = pandoc.Div(el)
  end

  el.identifier = thm.identifier -- restore identifier to render correctly
  local label = thm.identifier
  local type = refType(thm.identifier)
  local name = quarto.utils.as_inlines(thm.name)
  local theorem_type = theorem_types[refType(thm.identifier)]
  local order = thm.order

  -- add class for type
  el.attr.classes:insert("theorem")
  if theorem_type.env ~= "theorem" then
    el.attr.classes:insert(theorem_type.env)
  end
    
  -- If this theorem has no content, then create a placeholder
  if #el.content == 0 or el.content[1].t ~= "Para" then
    tprepend(el.content, {pandoc.Para({pandoc.Str '\u{a0}'})})
  end

  if _quarto.format.isLatexOutput() then
    local preamble = pandoc.Para(pandoc.RawInline("latex", 
      "\\begin{" .. theorem_type.env .. "}"))
    preamble.content:insert(pandoc.RawInline("latex", "["))
    if name then
      tappend(preamble.content, name)
    end
    preamble.content:insert(pandoc.RawInline("latex", "]"))
    preamble.content:insert(pandoc.RawInline("latex",
      "\\protect\\hypertarget{" .. label .. "}{}\\label{" .. label .. "}")
    )
    el.content:insert(1, preamble)
    el.content:insert(pandoc.Para(pandoc.RawInline("latex", 
      "\\end{" .. theorem_type.env .. "}"
    )))
    -- Remove id on those div to avoid Pandoc inserting \hypertaget #3776
    el.attr.identifier = ""
  elseif _quarto.format.isJatsOutput() then

    -- JATS XML theorem
    local lbl = captionPrefix({}, type, theorem_type, order)
    el = jatsTheorem(el, lbl, name)          

  elseif _quarto.format.isTypstOutput() then
    ensure_typst_theorems(type)
    local preamble = pandoc.Plain({pandoc.RawInline("typst", "#" .. theorem_type.env .. "(")})
    if name and #name > 0 then
      preamble.content:insert(pandoc.RawInline("typst", 'title: "'))
      tappend(preamble.content, name)
      preamble.content:insert(pandoc.RawInline("typst", '"'))
    end
    preamble.content:insert(pandoc.RawInline("typst", ")["))
    local callthm = make_scaffold(pandoc.Div, preamble)
    tappend(callthm.content, quarto.utils.as_blocks(el.content))
    callthm.content:insert(pandoc.RawInline("typst", "] <" .. el.attr.identifier .. ">"))
    return callthm

  else
    -- order might be nil in the case of an ipynb rendering in
    -- manuscript mode
    --
    -- FIXME format == ipynb and enableCrossRef == false should be
    -- its own rendering format
    if order == nil then
      return el
    end
    -- create caption prefix
    local captionPrefix = captionPrefix(name, type, theorem_type, order)
    local prefix =  { 
      pandoc.Span(
        pandoc.Strong(captionPrefix), 
        pandoc.Attr("", { "theorem-title" })
      ),
      pandoc.Space()
    }

    -- prepend the prefix
    local caption = el.content[1]

    if caption.content == nil then
      -- https://github.com/quarto-dev/quarto-cli/issues/2228
      -- caption doesn't always have a content field; in that case,
      -- use the parent?
      tprepend(el.content, prefix)
    else
      tprepend(caption.content, prefix)
    end
  end
 
  return el

end)
