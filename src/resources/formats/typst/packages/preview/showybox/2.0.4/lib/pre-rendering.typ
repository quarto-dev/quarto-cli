/*
 * ShowyBox - A package for Typst
 * Pablo González Calderón and Showybox Contributors (c) 2023-2024
 *
 * lib/pre-rendering.typ -- The package's file containing all
 * the internal functions used for pre-rendering some components
 * to get their dimensions or properties.
 *
 * This file is under the MIT license. For more
 * information see LICENSE on the package's main folder.
 */

#import "id.typ": *
#import "sections.typ": *

/*
 * Function: showy-pre-render-title()
 *
 * Description: Pre-renders the title emulating the conditions of
 * the final container.
 *
 * Parameters:
 * + sbox-props: Showybox properties
 */
#let showy-pre-render-title(sbox-props, id) = context {
  let my-state = state("showybox-" + id, 0pt)

  layout(size => {
    // Get full container's width in a length type
    let container-width = if type(sbox-props.width) == ratio {
      sbox-props.width * size.width
    } else {
      sbox-props.width
    }

    let pre-rendered = block(
      spacing: 0pt,
      width: container-width,
      fill: yellow,
      inset: (x: 1em),
      showy-title(sbox-props),
    )

    let rendered-size = measure(pre-rendered, ..size)

    // Store the height in the state
    my-state.update(rendered-size.height)
  })
  //v(-(my-state.final(loc) + sbox-props.frame.thickness)/2)
}
