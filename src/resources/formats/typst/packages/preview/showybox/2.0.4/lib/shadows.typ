/*
 * ShowyBox - A package for Typst
 * Pablo González Calderón and Showybox Contributors (c) 2023-2024
 *
 * lib/shadows.typ -- The package's file containing all the
 * internal functions for drawing shadows.
 *
 * This file is under the MIT license. For more
 * information see LICENSE on the package's main folder.
 */

#import "func.typ": *
#import "id.typ": *
#import "sections.typ": *

/*
 * Function: showy-shadow()
 *
 * Description: Draws the showybox main shadow
 * (excludes boxed title shadows).
 *
 * Parameters:
 * + sbox-props: Showybox properties
 * + sbox: Pre-rendered showybox
 */
#let showy-shadow(sbox-props, sbox, id) = context {
  if sbox-props.shadow == none {
    return sbox
  }
  let my-state = state("showybox-" + id, 0pt)

  /* If it has a boxed sbox-props.title, leave some space
   * to avoid collisions with other elements next to the
   * showybox */
  if sbox-props.title != "" and sbox-props.title-style.boxed-style != none {
    if sbox-props.title-style.boxed-style.anchor.y == bottom {
      v(my-state.at(here()))
    } else if sbox-props.title-style.boxed-style.anchor.y == horizon{
      v(my-state.at(here())/2)
    } // Otherwise, no space is needed

  }

  block(
    breakable: sbox-props.breakable,
    radius: sbox-props.frame.radius,
    fill: sbox-props.shadow.color,
    width: sbox-props.width,
    spacing: 0pt,
    outset: (
      left: -sbox-props.shadow.offset.x,
      right: sbox-props.shadow.offset.x,
      bottom: sbox-props.shadow.offset.y,
      top: -sbox-props.shadow.offset.y
    ),
    /* If it have a boxed title, substract some space to
        avoid the shadow to be body + title height, and only
        body height */
    if sbox-props.title != "" and sbox-props.title-style.boxed-style != none {
      if sbox-props.title-style.boxed-style.anchor.y == bottom {
        v(-my-state.at(here()))
      } else if sbox-props.title-style.boxed-style.anchor.y == horizon {
        v(-my-state.at(here())/2)
      } // Otherwise do nothing

      sbox
    } else {
      sbox
    }
  )
}

/*
 * Function: showy-boxed-title-shadow()
 *
 * Description: Draws the showybox's boxed title shadow
 *
 * Parameters:
 * + sbox-props: Showybox properties
 * + tbox: Pre-rendered boxed-title
 */
#let showy-boxed-title-shadow(sbox-props, id) = context {
  if sbox-props.shadow == none {
    return
  } else if sbox-props.title == "" or sbox-props.title-style.boxed-style == none {
    return
  }

  let my-state = state("showybox-" + id, 0pt)

  return place(
    top + sbox-props.title-style.boxed-style.anchor.x,
    dx: sbox-props.title-style.boxed-style.offset.x,
    dy: sbox-props.title-style.boxed-style.offset.y + if sbox-props.title-style.boxed-style.anchor.y == bottom {
      -my-state.final()
    } else if sbox-props.title-style.boxed-style.anchor.y == horizon {
      -my-state.final()/2
    },
    block(
      spacing: 0pt,
      inset: (x: 1em),
      block(
        breakable: sbox-props.breakable,
        radius: sbox-props.title-style.boxed-style.radius,
        fill: sbox-props.shadow.color,
        spacing: 0pt,
        outset: (
          left: -sbox-props.shadow.offset.x,
          right: sbox-props.shadow.offset.x,
          top: -sbox-props.shadow.offset.y,
          bottom: sbox-props.shadow.offset.y
        ),
        hide(showy-title(sbox-props))
      )
    )
  )
}

