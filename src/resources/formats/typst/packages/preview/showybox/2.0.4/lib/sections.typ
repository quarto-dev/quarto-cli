/*
 * ShowyBox - A package for Typst
 * Pablo González Calderón and Showybox Contributors (c) 2023
 *
 * lib/sections.typ -- The package's file containing all the
 * internal functions for drawing sections.
 *
 * This file is under the MIT license. For more
 * information see LICENSE on the package's main folder.
 */

#import "func.typ": *

/*
 * Function: showy-get-title-props()
 *
 * Description: Returns the title's properties
 *
 * Parameters:
 * + sbox-props: Showybox properties
 */
#let showy-get-title-props(sbox-props) = {
  /*
   * Properties independent of `boxed`
   */
  let props = (
    spacing: 0pt,
    fill: sbox-props.frame.title-color,
    inset: showy-section-inset("title", sbox-props.frame)
  )

  /*
   * Properties dependent of `boxed`
   */
  if sbox-props.title-style.boxed-style != none {
    props = props + (
      width: auto,
      radius: sbox-props.title-style.boxed-style.radius,
      stroke: showy-stroke(sbox-props.frame),
    )
  } else {
    props = props + (
      width: 100%,
      radius: (
        top-left: showy-value-in-direction("top-left", sbox-props.frame.radius, 5pt),
        top-right: showy-value-in-direction("top-right", sbox-props.frame.radius, 5pt),
        bottom: 0pt
        ),
      stroke: showy-stroke(sbox-props.frame, bottom: sbox-props.title-style.sep-thickness)
    )
  }
  return props
}

/*
 * Function: showy-title()
 *
 * Description: Returns the title's block
 *
 * Parameters:
 * + sbox-props: Showybox properties
 */
#let showy-title(sbox-props) = block(
  ..showy-get-title-props(sbox-props),
  align(
    sbox-props.title-style.align,
    text(
      sbox-props.title-style.color,
      weight: sbox-props.title-style.weight,
      sbox-props.title
    )
  )
)

/*
 * Function: showy-body()
 *
 * Description: Returns the body's block
 *
 * Parameters:
 * + sbox-props: Showybox properties
 * + body: Body content
 */
#let showy-body(sbox-props, ..body) = block(
    width: 100%,
    spacing: 0pt,
    breakable: sbox-props.breakable,
    inset:  showy-section-inset("body", sbox-props.frame),
    align(
        sbox-props.body-style.align,
        text(
        sbox-props.body-style.color,
        body.pos()
            .map(block.with(spacing:0pt, width: 100%, breakable: sbox-props.breakable))
            .join(
                block(
                    spacing: sbox-props.sep.gutter,
                    align(
                        left, // Avoid alignment errors
                        showy-line(sbox-props.frame)(
                            stroke: (
                                paint: sbox-props.frame.border-color,
                                dash: sbox-props.sep.dash,
                                thickness: sbox-props.sep.thickness
                            )
                        )
                    )
                )
            )
        )
    )
)

/*
 * Function: showy-footer()
 *
 * Description: Returns the footer's block
 *
 * Parameters:
 * + sbox-props: Showybox properties
 * + body: Body content
 */
#let showy-footer(sbox-props, footer) = block(
    width: 100%,
    spacing: 0pt,
    inset: showy-section-inset("footer", sbox-props.frame),
    fill: sbox-props.frame.footer-color,
    stroke: showy-stroke(sbox-props.frame, top: sbox-props.footer-style.sep-thickness),
    radius: (
      bottom-left: showy-value-in-direction("bottom-left", sbox-props.frame.radius, 5pt),
      bottom-right: showy-value-in-direction("bottom-right", sbox-props.frame.radius, 5pt),
      top: 0pt
    ),
    align(
        sbox-props.footer-style.align,
        text(
            sbox-props.footer-style.color,
            weight: sbox-props.footer-style.weight,
            footer
        )
    )
)