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
  exr  = {
    env = "exercise",
    style = "definition",
    title = "Exercise"
  }
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

_quarto.ast.add_renderer("Theorem", function()
  return true 
end, function(thm)
  local el = thm.div
  if pandoc.utils.type(el) == "Blocks" then
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
    local lbl = captionPrefix(nil, type, theorem_type, order)
    el = jatsTheorem(el, lbl, name)          
    
  else
    -- create caption prefix
    local captionPrefix = captionPrefix(name, type, theorem_type, order)
    local prefix =  { 
      pandoc.Span(
        pandoc.Strong(captionPrefix), 
        pandoc.Attr("", { "theorem-title" })
      )
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
