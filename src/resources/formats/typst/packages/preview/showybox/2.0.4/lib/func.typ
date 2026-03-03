/*
 * ShowyBox - A package for Typst
 * Pablo González Calderón and Showybox Contributors (c) 2023
 *
 * lib/func.typ -- The package's file containing all the
 * internal functions used by showybox()
 *
 * This file is under the MIT license. For more
 * information see LICENSE on the package's main folder.
 */

/*
 * Function: showy-value-in-direction()
 *
 * Description: Helper function to get a value
 * in a specific direction inside a dictionary or value
 *
 * Parameters:
 * + direction: Direction as an alignement or string
 * + value: Dictionary or value to search in
 * + default: Default value if nothing is found
 */
#let showy-value-in-direction(direction, value, default) = {
  if type(direction) != str {
    direction = repr(direction)
  }
  if type(value) == dictionary {
    if direction in value {
      value.at(direction)
    } else if direction in ("left", "right") and "x" in value {
      value.x
    } else if direction in ("top", "bottom") and "y" in value {
      value.y
    } else if direction in ("top-left", "top-right") and "top" in value {
      value.top
    } else if direction in ("bottom-left", "bottom-right") and "bottom" in value {
      value.bottom
    } else if "rest" in value {
      value.rest
    } else {
      default
    }
  } else if value == none {
    default
  } else {
    value
  }
}

/*
 * Function: showy-section-inset()
 *
 * Description: Gets the inset value for the given
 * section ("title", "body", "footer"), checking if
 * it's declared in `title-inset`, `body-inset` or
 * `footer-inset` instead of `inset`
 *
 * Parameters:
 * + section: Section to retrieve the inset ("title", "body" or "footer")
 * + frame: The dictionary with frame settings
 */
#let showy-section-inset(section, frame) = {
  return frame.at(
    section + "-inset",
    default: frame.inset
  )
}

/*
 * Function: showy-line()
 *
 * Description: Creates a modified `#line()` function
 * to draw a separator line with start and end points
 * adjusted to insets.
 *
 * Parameters:
 * + frame: The dictionary with frame settings
 */
#let showy-line(frame) = {
  let inset = showy-section-inset("body", frame)
  let inset = (
    left: showy-value-in-direction(left, inset, 0pt),
    right: showy-value-in-direction(right, inset, 0pt)
  )
  let (start, end) = (0%, 0%)

  // For relative insets the original width needs to be calculated
  if type(inset.left) == ratio and type(inset.right) == ratio {
    let full = 100% / (1 - float(inset.right) - float(inset.left))
    start = -inset.left * full
    end = full + start
  } else if type(inset.left) == ratio {
    let full = (100% + inset.right) / (1 - float(inset.left))
    (start, end) = (-inset.left * full, 100% + inset.right)
  } else if type(inset.right) == ratio {
    let full = (100% + inset.left) / (1 - float(inset.right))
    (start, end) = (-inset.left, full - inset.left)
  } else {
    (start, end) = (-inset.left, 100% + inset.right)
  }

  line.with(
    start: (start, 0%),
    end: (end, 0%)
  )
}
/*
 * Function: showy-stroke()
 *
 * Description: Creates a stroke or set of strokes
 * to use as borders.
 *
 * Parameters:
 * + frame: The dictionary with frame settings
 */
#let showy-stroke(frame, ..overrides) = {
  let (paint, dash, width) = (
    frame.border-color,
    frame.dash,
    frame.thickness
  )

  let strokes = (:)
  if type(width) != dictionary { // Set all borders at once
    for side in ("top", "bottom", "left", "right") {
      strokes.insert(side, (paint: paint, dash: dash, thickness: width))
    }
  } else { // Set each border individually
    for pair in width {
      strokes.insert(
        pair.first(), // key
        (paint: paint, dash: dash, thickness: pair.last())
      )
    }
  }
  for pair in overrides.named() {
    strokes.insert(
      pair.first(),
      (paint: paint, dash: dash, thickness: pair.last())
    )
  }
  return strokes
}