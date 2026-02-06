// Currently, we assume there is no need to enable Pro sets for only a part of the document,
// so no method is provided to disable Pro sets
#let _fa_use_pro = state("_fa_use_pro", false)
#let fa-use-pro() = {
  _fa_use_pro.update(true)
}

/// Render a Font Awesome icon by its name or unicode
///
/// Parameters:
/// - `name`: The name of the icon
///   - This can be name in string or unicode of the icon
/// - `solid`: Whether to use the solid version of the icon
/// - `fa-icon-map`: The map of icon names to unicode
///   - Default is a map generated from FontAwesome metadata
///   - *Not recommended* You can provide your own map to override it
/// - `..args`: Additional arguments to pass to the `text` function
///
/// Returns: The rendered icon as a `text` element
#let fa-icon(
  name,
  solid: false,
  fa-icon-map: (:),
  ..args,
) = (
  context {
    let default_fonts = (
      "Font Awesome 6 Free" + if solid {
        " Solid"
      },
      "Font Awesome 6 Brands",
    )

    if _fa_use_pro.get() {
      // TODO: Help needed to test following fonts
      default_fonts += (
        "Font Awesome 6 Pro" + if solid {
          " Solid"
        },
        "Font Awesome 6 Duotone",
        "Font Awesome 6 Sharp" + if solid {
          " Solid"
        },
        "Font Awesome 6 Sharp Duotone" + if solid {
          " Solid"
        },
      )
    }

    text(
    font: default_fonts, // If you see warning here, please check whether the FA font is installed

    // TODO: We might need to check whether this is needed
    weight: if solid { 900 } else { 400 },
    // If the name is in the map, use the unicode from the map
    // If not, pass the name and let the ligature feature handle it
    fa-icon-map.at(name, default: name),
    ..args,
  )
  }
)
