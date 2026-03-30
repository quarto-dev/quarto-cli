#import "../core.typ": *
#import "../deps.typ": octique-inline, showybox

/// Global result configuration to control visibility of proofs and solutions
/// Modified by `#set-result("noanswer")`
/// - "answer": Show proofs and solutions (default)
/// - "noanswer": Hide proofs and solutions
#let (get-result, set-result) = use-state("theorion-result", "answer")

/// Global QED symbol configuration
/// Modified by `#set-qed-symbol(sym.square.stroked)`
/// Default is `sym.square`
#let (get-qed-symbol, set-qed-symbol) = use-state("theorion-qed-symbol", sym.square)

/// Create an example environment with italic title
///
/// - title (string|dict): Title text or dictionary for i18n. Default is "Example"
/// - body (content): Content of the example
/// -> content
#let example(
  title: theorion-i18n-map.at("example"),
  body,
) = [#emph(theorion-i18n(title)).#sym.space#body]


/// Create a problem environment with italic title
///
/// - title (string|dict): Title text or dictionary for i18n. Default is "Problem"
/// - body (content): Content of the problem
/// -> content
#let problem(
  title: theorion-i18n-map.at("problem"),
  body,
) = [#emph(theorion-i18n(title)).#sym.space#body]

/// Create a solution environment with italic title
/// Can be hidden using #set-result("noanswer")
///
/// - title (string|dict): Title text or dictionary for i18n. Default is "Solution"
/// - body (content): Content of the solution
/// -> content
#let solution(
  title: theorion-i18n-map.at("solution"),
  body,
) = context if get-result(here()) == "noanswer" { none } else [#emph(theorion-i18n(title)).#sym.space#body]

/// Create a conclusion environment with italic title
///
/// - title (string|dict): Title text or dictionary for i18n. Default is "Conclusion"
/// - body (content): Content of the conclusion
/// -> content
#let conclusion(
  title: theorion-i18n-map.at("conclusion"),
  body,
) = [#emph(theorion-i18n(title)).#sym.space#body]

/// Create an exercise environment with italic title
///
/// - title (string|dict): Title text or dictionary for i18n. Default is "Exercise"
/// - body (content): Content of the exercise
/// -> content
#let exercise(
  title: theorion-i18n-map.at("exercise"),
  body,
) = [#emph(theorion-i18n(title)).#sym.space#body]

/// Create a proof environment with italic title and QED symbol
/// Can be hidden using #set-result("noanswer")
/// Uses global QED symbol set by #set-qed-symbol()
///
/// - title (string|dict): Title text or dictionary for i18n. Default is "Proof"
/// - qed (symbol): Symbol to use for end of proof. Default is from global setting
/// - body (content): Content of the proof
/// -> content
#let proof(
  title: theorion-i18n-map.at("proof"),
  qed: auto,
  body,
) = context if get-result(here()) == "noanswer" { none } else {
  let qed-symbol = if qed == auto { get-qed-symbol(here()) } else { qed }
  [#emph(theorion-i18n(title)).#sym.space#body#box(width: 0em)#h(1fr)#sym.wj#sym.space.nobreak$#qed-symbol$]
}

/// Create an emphasized box with yellow styling and dashed border
///
/// - body (content): Content of the box
/// -> content
#let emph-box(body, breakable: false) = {
  // Main rendering
  let rendered = showybox(
    frame: (
      dash: "dashed",
      border-color: yellow.darken(30%),
      body-color: yellow.lighten(90%),
    ),
    sep: (dash: "dashed"),
    breakable: breakable,
    body,
  )
  if "html" in dictionary(std) {
    // HTML rendering
    context if target() == "html" {
      html.elem(
        "div",
        attrs: (
          style: "background: #FFFDEB; border: .1em dashed #E3C000; border-radius: .4em; padding: .25em 1em; width: 100%; box-sizing: border-box; margin: .5em 0em;",
        ),
        body,
      )
    } else {
      rendered
    }
  } else {
    rendered
  }
}

/// Create a quote box with start border styling in gray
///
/// - body (content): Content to be quoted
/// -> content
#let quote-box(..args, body) = context {
  // HTML rendering
  if "html" in dictionary(std) and target() == "html" {
    html.elem(
      "div",
      attrs: (
        style: "border-inline-start: .25em solid #C8C8C8; padding: .1em 1em; width: 100%; box-sizing: border-box; margin-bottom: .5em; color: #646464;",
      ),
      body,
    )
  } else {
    // Main rendering
    block(stroke: language-aware-start(.25em + luma(200)), inset: language-aware-start(1em) + (y: .75em), ..args, text(
      luma(100),
      body,
    ))
  }
}

/// Create a note box with customizable styling and icon
/// Base template for tip-box, important-box, warning-box, and caution-box
///
/// - fill (color): Color of the border and icon. Default is `rgb("#0969DA")`
/// - title (string|dict): Title text or dictionary for i18n. Default is "Note"
/// - icon-name (string): Name of the icon to display from octicons set
/// - body (content): Content of the note
/// -> content
#let note-box(
  fill: rgb("#0969DA"),
  title: theorion-i18n-map.at("note"),
  icon-name: "info",
  ..args,
  body,
) = context {
  let title-i18n = theorion-i18n(title)
  // HTML rendering
  if "html" in dictionary(std) and target() == "html" {
    html.elem(
      "div",
      attrs: (
        style: "border-inline-start: .25em solid "
          + fill.to-hex()
          + "; padding: .1em 1em; width: 100%; box-sizing: border-box; margin-bottom: .5em;",
      ),
      {
        html.elem(
          "p",
          attrs: (
            style: "margin-top: .5em; font-weight: bold; color: "
              + fill.to-hex()
              + "; display: flex; align-items: center;",
          ),
          html.elem(
            "span",
            attrs: (
              style: "display: inline-flex; align-items: center; justify-content: center; width: 1em; height: 1em; vertical-align: middle; margin: 0em .5em 0em 0em;",
            ),
            html.frame(octique-inline(
              height: 1.2em,
              width: 1.2em,
              color: fill,
              baseline: .2em,
              icon-name,
            )),
          )
            + title-i18n,
        )
        body
      },
    )
  } else {
    // Main rendering
    block(
      stroke: language-aware-start(.25em + fill),
      inset: language-aware-start(1em) + (top: .5em, bottom: .75em),
      width: 100%,
      ..args,
      {
        block(sticky: true, text(
          fill: fill,
          weight: "semibold",
          octique-inline(
            height: 1.2em,
            width: 1.2em,
            color: fill,
            baseline: .2em,
            icon-name,
          )
            + h(.5em)
            + title-i18n,
        ))
        body
      },
    )
  }
}

/// Create a tip box with green styling and light bulb icon
/// Useful for helpful suggestions and tips
#let tip-box = note-box.with(
  fill: rgb("#1A7F37"),
  title: theorion-i18n-map.at("tip"),
  icon-name: "light-bulb",
)

/// Create an important box with purple styling and report icon
/// Useful for highlighting key information
#let important-box = note-box.with(
  fill: rgb("#8250DF"),
  title: theorion-i18n-map.at("important"),
  icon-name: "report",
)

/// Create a warning box with amber styling and alert icon
/// Useful for potential issues or warnings
#let warning-box = note-box.with(
  fill: rgb("#9A6700"),
  title: theorion-i18n-map.at("warning"),
  icon-name: "alert",
)

/// Create a caution box with red styling and stop icon
/// Useful for serious warnings or dangerous situations
#let caution-box = note-box.with(
  fill: rgb("#CF222E"),
  title: theorion-i18n-map.at("caution"),
  icon-name: "stop",
)

/// Create a remark environment
///
/// - title (string|dict): Title text or dictionary for i18n. Default is "Remark"
/// - body (content): Content of the remark
/// -> content
#let remark = note-box.with(
  fill: rgb("#118D8D"),
  title: theorion-i18n-map.at("remark"),
  icon-name: "comment",
)
