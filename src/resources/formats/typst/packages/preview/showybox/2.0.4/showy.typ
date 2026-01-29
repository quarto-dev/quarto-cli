/*
 * ShowyBox - A package for Typst
 * Pablo González Calderón and Showybox Contributors (c) 2023-2024
 *
 * Main Contributors:
 * - Jonas Neugebauer (<https://github.com/jneug>)
 *
 * showy.typ -- The package's main file containing the
 * public and (more) useful functions
 *
 * This file is under the MIT license. For more
 * information see LICENSE on the package's main folder.
 */

/*
 * Import functions
 */
#import "lib/func.typ": *
#import "lib/sections.typ": *
#import "lib/shadows.typ": *
#import "lib/id.typ": *
#import "lib/pre-rendering.typ": *

/*
 * Function: showybox()
 *
 * Description: Creates a showybox
 *
 */
#let showybox(
  frame: (:),
  title-style: (:),
  boxed-style: (:),
  body-style: (:),
  footer-style: (:),
  sep: (:),
  shadow: none,
  width: 100%,
  breakable: false,
  /* align: none, / collides with align-function */
  /* spacing, above, and below are by default what's set for all `block`s */
  title: "",
  footer: "",
  ..body,
) = {
  /*
   * Complete and store all the dictionary-like-properties inside a
   * single dictionary. This will improve readability and avoids to
   * constantly have a default option while accessing
   */
  let props = (
    frame: (
      title-color: frame.at("title-color", default: black),
      body-color: frame.at("body-color", default: white),
      border-color: frame.at("border-color", default: black),
      footer-color: frame.at("footer-color", default: luma(220)),
      inset: frame.at("inset", default: (x: 1em, y: .65em)),
      radius: frame.at("radius", default: 5pt),
      thickness: frame.at("thickness", default: 1pt),
      dash: frame.at("dash", default: "solid"),
    ),
    title-style: (
      color: title-style.at("color", default: white),
      weight: title-style.at("weight", default: "regular"),
      align: title-style.at("align", default: start),
      sep-thickness: title-style.at("sep-thickness", default: 1pt),
      boxed-style: if title-style.at("boxed-style", default: none) != none and type(title-style.at("boxed-style", default: none)) == dictionary {
        (
          anchor: (
            y: title-style.boxed-style.at("anchor", default: (:)).at("y", default: horizon),
            x: title-style.boxed-style.at("anchor", default: (:)).at("x", default: start),
          ),
          offset: (
            x: title-style.boxed-style.at("offset", default: (:)).at("x", default: 0pt),
            y: title-style.boxed-style.at("offset", default: (:)).at("y", default: 0pt),
          ),
          radius: title-style.boxed-style.at("radius", default: 5pt),
        )
      } else {
        none
      },
    ),
    body-style: (
      color: body-style.at("color", default: black),
      align: body-style.at("align", default: start),
    ),
    footer-style: (
      color: footer-style.at("color", default: luma(85)),
      weight: footer-style.at("weight", default: "regular"),
      align: footer-style.at("align", default: start),
      sep-thickness: footer-style.at("sep-thickness", default: 1pt),
    ),
    sep: (
      thickness: sep.at("thickness", default: 1pt),
      dash: sep.at("dash", default: "solid"),
      gutter: sep.at("gutter", default: 0.65em),
    ),
    shadow: if shadow != none {
      if type(shadow.at("offset", default: 4pt)) != dictionary {
        (offset: (
          x: shadow.at("offset", default: 4pt),
          y: shadow.at("offset", default: 4pt),
        ), color: shadow.at("color", default: luma(128)))
      } else {
        (offset: (
          x: shadow.at("offset").at("x", default: 4pt),
          y: shadow.at("offset").at("y", default: 4pt),
        ), color: shadow.at("color", default: luma(128)))
      }
    } else {
      none
    },
    breakable: breakable,
    width: width,
    title: title,
  )
  // Add title, body and footer inset (if present)
  for section-inset in ("title-inset", "body-inset", "footer-inset") {
    let value = frame.at(section-inset, default: none)
    if value != none {
      props.frame.insert(section-inset, value)
    }
  }

  _showy-id.step()
  context {
    let id = str(_showy-id.get().first())

    /*
     * Update title height in state.
     *
     * NOTE: Although a `place` and `hide` are used in the pre-render
     * function, for avoiding nesting components inside unaccesible
     * containers, we must call this function inside another `place`.
     */

    if title != "" and props.title-style.boxed-style != none {
      place(top, showy-pre-render-title(props, id))
    }

    /*
         *  Alignment wrapper
         */
    let alignprops = (:)
    for prop in ("spacing", "above", "below") {
      if prop in body.named() {
        alignprops.insert(prop, body.named().at(prop))
      }
    }
    let alignwrap(content) = block(
      ..alignprops,
      breakable: breakable,
      width: 100%,
      if "align" in body.named() and body.named().align != none {
        align(body.named().align, content)
      } else {
        content
      },
    )

    let showyblock = context {
      let my-state = state("showybox-" + id, 0pt)

      // /*
      //  * Decide wheter add a page break or not, based on the remaining
      //  * space in the page. For calculating it, we substract the page
      //  * margin to the page size. Later, we estimate a minimum size of
      //  * the showybox, adding the frame thickness, the frame inset,
      //  * and the size of 1 line of text.
      //  */
      // let abs-margin = if page.margin == auto {
      //   let small-side = calc.min(page.height, page.width)
      //   (2.5/21) * small-side  // According to docs, this is the 'auto' margin
      // } else {
      //   margin.at("y", default: margin.at("top", default: margin.rest))
      // }

      // let remaining = 0pt
      // let to-use = 0pt
      // remaining = page.height - location.position(here()).y - abs-margin
      // to-use += text.size.to-absolute()

      // if type(props.frame.thickness) == dictionary {
      //   to-use += props.frame.thickness.at("y", default: props.frame.thickness.at("top", default: props.frame.inset.at("rest", default: .65em))).to-absolute()
      //   to-use += props.frame.thickness.at("y", default: props.frame.thickness.at("bottom", default: props.frame.inset.at("rest", default: .65em))).to-absolute()
      // } else {
      //   to-use += 2*props.frame.thickness
      // }

      // if type(props.frame.inset) == dictionary {
      //   to-use += 4*props.frame.inset.at("y", default: props.frame.inset.at("top", default: props.frame.inset.at("rest", default: .65em))).to-absolute()
      // } else {
      //   to-use += 4*props.frame.inset.to-absolute()
      // }

      // // Since we cannot add a pagebreak directly, add the to-use space,
      // // which would be greater than the remaining space.
      // if remaining - to-use <= 0pt {
      //   v(to-use)
      // }

      if title != "" and props.title-style.boxed-style != none {
        if props.title-style.boxed-style.anchor.y == bottom {
          v(my-state.final())
        } else if props.title-style.boxed-style.anchor.y == horizon {
          v(my-state.final() / 2)
        } // Otherwise don't add extra space

        // Add the boxed-title shadow before rendering the body
        if props.shadow != none {
          showy-boxed-title-shadow(props, id)
        }
      }

      block(
        width: if props.shadow == none {
          width
        } else {
          100%
        },
        fill: props.frame.body-color,
        radius: props.frame.radius,
        inset: 0pt,
        spacing: 0pt,
        breakable: breakable,
        stroke: showy-stroke(props.frame),
      )[
        /*
         * Title of the showybox
         */
        #if title != "" and props.title-style.boxed-style == none {
          showy-title(props)
        } else if title != "" and props.title-style.boxed-style != none {
          if props.title-style.boxed-style.anchor.y == top {
            v(my-state.final())
          } else if props.title-style.boxed-style.anchor.y == horizon {
            v(my-state.final() / 2)
          }

          place(
            top + props.title-style.boxed-style.anchor.x,
            dx: props.title-style.boxed-style.offset.x,
            dy: props.title-style.boxed-style.offset.y + if props.title-style.boxed-style.anchor.y == bottom {
              -my-state.final()
            } else if props.title-style.boxed-style.anchor.y == horizon {
              -my-state.final() / 2
            },
            block(spacing: 0pt, inset: (x: 1em), showy-title(props)),
          )
        }

        /*
         * Body of the showybox
         */
        #showy-body(props, ..body)

        /*
         * Footer of the showybox
         */
        #if footer != "" {
          showy-footer(props, footer)
        }
      ]
    }

    alignwrap(showy-shadow(props, showyblock, id))
  }
}