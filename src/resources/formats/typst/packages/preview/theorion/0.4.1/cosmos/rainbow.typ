#import "../core.typ": *

/// A simple render function with a colored start border
#let render-fn(
  fill: red,
  prefix: none,
  title: "",
  full-title: auto,
  ..args,
  body,
) = context {
  // HTML rendering
  if "html" in dictionary(std) and target() == "html" {
    html.elem("div", attrs: (
      style: "border-inline-start: .25em solid "
        + fill.to-hex()
        + "; padding: .1em 1em; width: 100%; box-sizing: border-box; margin-bottom: .5em;",
    ))[
      #if full-title != "" {
        html.elem(
          "p",
          attrs: (
            style: "margin-top: .5em; font-weight: bold; color: " + fill.to-hex() + ";",
          ),
          full-title,
        )
      }
      #body
    ]
  } else {
    // Main rendering
    block(
      stroke: language-aware-start(.25em + fill),
      inset: language-aware-start(1em) + (y: .75em),
      width: 100%,
      ..args,
      [
        #if full-title != "" {
          block(sticky: true, strong(text(fill: fill, full-title)))
        }
        #body
      ],
    )
  }
}

// Core theorems
#let (theorem-counter, theorem-box, theorem, show-theorem) = make-frame(
  "theorem",
  theorion-i18n-map.at("theorem"),
  inherited-levels: 2,
  render: render-fn.with(fill: red.darken(20%)),
)

#let (lemma-counter, lemma-box, lemma, show-lemma) = make-frame(
  "lemma",
  theorion-i18n-map.at("lemma"),
  counter: theorem-counter,
  render: render-fn.with(fill: teal.darken(10%)),
)

#let (corollary-counter, corollary-box, corollary, show-corollary) = make-frame(
  "corollary",
  theorion-i18n-map.at("corollary"),
  inherited-from: theorem-counter,
  render: render-fn.with(fill: fuchsia.darken(10%)),
)

// Definitions and foundations
#let (definition-counter, definition-box, definition, show-definition) = make-frame(
  "definition",
  theorion-i18n-map.at("definition"),
  counter: theorem-counter,
  render: render-fn.with(fill: orange),
)

#let (axiom-counter, axiom-box, axiom, show-axiom) = make-frame(
  "axiom",
  theorion-i18n-map.at("axiom"),
  counter: theorem-counter,
  render: render-fn.with(fill: green.darken(20%)),
)

#let (postulate-counter, postulate-box, postulate, show-postulate) = make-frame(
  "postulate",
  theorion-i18n-map.at("postulate"),
  counter: theorem-counter,
  render: render-fn.with(fill: maroon),
)

// Important results
#let (proposition-counter, proposition-box, proposition, show-proposition) = make-frame(
  "proposition",
  theorion-i18n-map.at("proposition"),
  counter: theorem-counter,
  render: render-fn.with(fill: blue.darken(10%)),
)

#let (assumption-counter, assumption-box, assumption, show-assumption) = make-frame(
  "assumption",
  theorion-i18n-map.at("assumption"),
  counter: theorem-counter,
  render: render-fn.with(fill: purple.darken(10%)),
)

#let (property-counter, property-box, property, show-property) = make-frame(
  "property",
  theorion-i18n-map.at("property"),
  counter: theorem-counter,
  render: render-fn.with(fill: eastern.darken(10%)),
)

#let (conjecture-counter, conjecture-box, conjecture, show-conjecture) = make-frame(
  "conjecture",
  theorion-i18n-map.at("conjecture"),
  counter: theorem-counter,
  render: render-fn.with(fill: navy.darken(10%)),
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
