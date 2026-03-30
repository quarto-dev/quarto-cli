#import "../core.typ": *
#import "../deps.typ": showybox

/// A fancy box design inspired by elegantbook style.
///
/// - get-border-color (function): Color of the box border. Default is `loc => orange.darken(0%)`.
/// - get-body-color (function): Color of the box background. Default is `loc => orange.lighten(95%)`.
/// - get-symbol (function): Symbol to display at bottom right. Default is `loc => sym.suit.heart.stroked`.
/// - prefix (content): Prefix text before the title. Default is `none`.
/// - title (string): Title of the box. Default is empty string.
/// - full-title (auto|content): Complete title including prefix. Default is `auto`.
/// - body (content): Content of the box.
/// -> content
#let fancy-box(
  get-border-color: loc => orange.darken(0%),
  get-body-color: loc => orange.lighten(95%),
  get-symbol: loc => sym.suit.heart.stroked,
  prefix: none,
  title: "",
  full-title: auto,
  breakable: false,
  html-width: 720pt,
  ..args,
  body,
) = context {
  // Main rendering
  let rendered = showybox(
    frame: (
      thickness: .05em,
      radius: .3em,
      inset: (x: 1.2em, top: if full-title != "" { .7em } else { 1.2em }, bottom: 1.2em),
      border-color: get-border-color(here()),
      title-color: get-border-color(here()),
      body-color: get-body-color(here()),
      title-inset: (x: 1em, y: .5em),
    ),
    title-style: (
      boxed-style: (
        anchor: (x: start, y: horizon),
        radius: 0em,
      ),
      color: white,
      weight: "semibold",
    ),
    breakable: breakable,
    title: {
      if full-title == auto {
        if prefix != none {
          [#prefix (#title)]
        } else {
          title
        }
      } else {
        full-title
      }
    },
    ..args,
    {
      body
      if get-symbol(here()) != none {
        place(end + bottom, dy: .8em, dx: .9em, text(size: .6em, fill: get-border-color(here()), get-symbol(here())))
      }
    },
  )
  if "html" in dictionary(std) and target() == "html" {
    html.elem("div", attrs: (style: "margin-bottom: .5em;"), html.frame(block(width: html-width, rendered)))
  } else {
    rendered
  }
}

/// Register global colors.
#let (get-primary-border-color, set-primary-border-color) = use-state("fancy-primary-border-color", green.darken(30%))
#let (get-primary-body-color, set-primary-body-color) = use-state("fancy-primary-body-color", green.lighten(95%))
#let (get-secondary-border-color, set-secondary-border-color) = use-state("fancy-secondary-border-color", orange.darken(
  0%,
))
#let (get-secondary-body-color, set-secondary-body-color) = use-state("fancy-secondary-body-color", orange.lighten(95%))
#let (get-tertiary-border-color, set-tertiary-border-color) = use-state("fancy-tertiary-border-color", blue.darken(30%))
#let (get-tertiary-body-color, set-tertiary-body-color) = use-state("fancy-tertiary-body-color", blue.lighten(95%))

/// Register global symbols.
#let (get-primary-symbol, set-primary-symbol) = use-state(
  "fancy-primary-symbol",
  sym.suit.club.filled,
)
#let (get-secondary-symbol, set-secondary-symbol) = use-state(
  "fancy-secondary-symbol",
  sym.suit.heart.stroked,
)
#let (get-tertiary-symbol, set-tertiary-symbol) = use-state(
  "fancy-tertiary-symbol",
  sym.suit.spade.filled,
)


/// Create corresponding theorem box.
#let (theorem-counter, theorem-box, theorem, show-theorem) = make-frame(
  "theorem",
  theorion-i18n-map.at("theorem"),
  inherited-levels: 2,
  render: fancy-box.with(
    get-border-color: get-secondary-border-color,
    get-body-color: get-secondary-body-color,
    get-symbol: get-secondary-symbol,
  ),
)

#let (lemma-counter, lemma-box, lemma, show-lemma) = make-frame(
  "lemma",
  theorion-i18n-map.at("lemma"),
  counter: theorem-counter,
  render: fancy-box.with(
    get-border-color: get-secondary-border-color,
    get-body-color: get-secondary-body-color,
    get-symbol: get-secondary-symbol,
  ),
)

#let (corollary-counter, corollary-box, corollary, show-corollary) = make-frame(
  "corollary",
  theorion-i18n-map.at("corollary"),
  inherited-from: theorem-counter,
  render: fancy-box.with(
    get-border-color: get-secondary-border-color,
    get-symbol: get-secondary-symbol,
    get-body-color: get-secondary-body-color,
  ),
)

#let (axiom-counter, axiom-box, axiom, show-axiom) = make-frame(
  "axiom",
  theorion-i18n-map.at("axiom"),
  counter: theorem-counter,
  render: fancy-box.with(
    get-border-color: get-secondary-border-color,
    get-body-color: get-secondary-body-color,
    get-symbol: get-secondary-symbol,
  ),
)

#let (postulate-counter, postulate-box, postulate, show-postulate) = make-frame(
  "postulate",
  theorion-i18n-map.at("postulate"),
  counter: theorem-counter,
  render: fancy-box.with(
    get-border-color: get-secondary-border-color,
    get-body-color: get-secondary-body-color,
    get-symbol: get-secondary-symbol,
  ),
)

#let (definition-counter, definition-box, definition, show-definition) = make-frame(
  "definition",
  theorion-i18n-map.at("definition"),
  counter: theorem-counter,
  render: fancy-box.with(
    get-border-color: get-primary-border-color,
    get-body-color: get-primary-body-color,
    get-symbol: get-primary-symbol,
  ),
)

#let (proposition-counter, proposition-box, proposition, show-proposition) = make-frame(
  "proposition",
  theorion-i18n-map.at("proposition"),
  counter: theorem-counter,
  render: fancy-box.with(
    get-border-color: get-tertiary-border-color,
    get-body-color: get-tertiary-body-color,
    get-symbol: get-tertiary-symbol,
  ),
)

#let (assumption-counter, assumption-box, assumption, show-assumption) = make-frame(
  "assumption",
  theorion-i18n-map.at("assumption"),
  counter: theorem-counter,
  render: fancy-box.with(
    get-border-color: get-secondary-border-color,
    get-body-color: get-secondary-body-color,
    get-symbol: get-secondary-symbol,
  ),
)

#let (property-counter, property-box, property, show-property) = make-frame(
  "property",
  theorion-i18n-map.at("property"),
  counter: theorem-counter,
  render: fancy-box.with(
    get-border-color: get-tertiary-border-color,
    get-body-color: get-tertiary-body-color,
    get-symbol: get-tertiary-symbol,
  ),
)

#let (conjecture-counter, conjecture-box, conjecture, show-conjecture) = make-frame(
  "conjecture",
  theorion-i18n-map.at("conjecture"),
  counter: theorem-counter,
  render: fancy-box.with(
    get-border-color: get-secondary-border-color,
    get-body-color: get-secondary-body-color,
    get-symbol: get-secondary-symbol,
  ),
)

/// Collection of show rules for all theorem environments
/// Applies all theorion-related show rules to the document
///
/// - body (content): Content to apply the rules to
/// -> content
#let show-theorion(body) = {
  show: show-theorem
  show: show-lemma
  show: show-corollary
  show: show-axiom
  show: show-postulate
  show: show-definition
  show: show-proposition
  show: show-assumption
  show: show-property
  show: show-conjecture
  body
}


/// Set the number of inherited levels for theorem environments
///
/// - value (integer): Number of levels to inherit
#let set-inherited-levels(value) = (theorem-counter.set-inherited-levels)(value)


/// Set the zero-fill option for theorem environments
///
/// - value (boolean): Whether to zero-fill the numbering
#let set-zero-fill(value) = (theorem-counter.set-zero-fill)(value)

/// Set the leading-zero option for theorem environments
///
/// - value (boolean): Whether to include leading zeros in the numbering
#let set-leading-zero(value) = (theorem-counter.set-leading-zero)(value)
