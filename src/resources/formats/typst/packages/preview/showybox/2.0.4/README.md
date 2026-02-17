# Showybox (v2.0.4)

**Showybox** is a Typst package for creating colorful and customizable boxes.

## Usage

To use this library through the Typst package manager (for Typst 0.6.0 or greater), write `#import "@preview/showybox:2.0.4": showybox` at the beginning of your Typst file.

Once imported, you can create an empty showybox by using the function `showybox()` and giving a default body content inside the parenthesis or outside them using squared brackets `[]`.

By default a `showybox` with these properties will be created:

- No title
- No shadow
- Not breakable
- Black borders
- White background
- `5pt` of border radius
- `1pt` of border thickness

```typst
#import "@preview/showybox:2.0.4": showybox

#showybox(
  [Hello world!]
)
```
<h3 align="center">
  <img alt="Hello world! example" src="assets/hello-world.png" style="max-width: 95%; background-color: #FFFFFF; padding: 10px; box-shadow: 1pt 1pt 10pt 0pt #AAAAAA; border-radius: 4pt">
</h3>

Looks quite simple, but the "magic" starts when adding a title, color and shadows. The following code creates two "unique" boxes with defined colors and custom borders:
```typst
// First showybox
#showybox(
  frame: (
    border-color: red.darken(50%),
    title-color: red.lighten(60%),
    body-color: red.lighten(80%)
  ),
  title-style: (
    color: black,
    weight: "regular",
    align: center
  ),
  shadow: (
    offset: 3pt,
  ),
  title: "Red-ish showybox with separated sections!",
  lorem(20),
  lorem(12)
)

// Second showybox
#showybox(
  frame: (
    dash: "dashed",
    border-color: red.darken(40%)
  ),
  body-style: (
    align: center
  ),
  sep: (
    dash: "dashed"
  ),
  shadow: (
	  offset: (x: 2pt, y: 3pt),
    color: yellow.lighten(70%)
  ),
  [This is an important message!],
  [Be careful outside. There are dangerous bananas!]
)
```
<h3 align="center">
  <img alt="Further examples" src="assets/two-easy-examples.png" style="max-width: 95%; background-color: #FFFFFF; padding: 10px 10px; box-shadow: 1pt 1pt 10pt 0pt #AAAAAA; border-radius: 4pt">
</h3>

## Reference

The `showybox()` function can receive the following parameters:
- `title`: A string used as the title of the showybox
- `footer`: A string used as the footer of the showybox
- `frame`: A dictionary containing the frame's properties
- `title-style`: A dictionary containing the title's styles
- `body-style`: A dictionary containing the body's styles
- `footer-style`: A dictionary containing the footer's styles
- `sep`: A dictionary containing the separator's properties
- `shadow`: A dictionary containing the shadow's properties
- `width`: A relative length indicating the showybox's width
- `align`: An unidimensional alignement for the showybox in the page
- `breakable`: A boolean indicating whether a showybox can break if it reached an end of page
- `spacing`: Space above and below the showybox
- `above`: Space above the showybox
- `below`: Space below the showybox
- `body`: The content of the showybox

### Frame properties
- `title-color`: Color used as background color where the title goes (default is `black`)
- `body-color`: Color used as background color where the body goes (default is `white`)
- `footer-color`: Color used as background color where the footer goes (default is `luma(85)`)
- `border-color`: Color used for the showybox's border (default is `black`)
- `inset`: Inset used for title, body and footer elements (default is `(x: 1em, y: 0.65em)`) if none of the followings are given:
  - `title-inset`: Inset used for the title
  - `body-inset`: Inset used for the body
  - `footer-inset`: Inset used for the body
- `radius`: Showybox's radius (default is `5pt`)
- `thickness`: Border thickness of the showybox (default is `1pt`)
- `dash`: Showybox's border style (default is `solid`)

### Title styles
- `color`: Text color (default is `white`)
- `weight`: Text weight (default is `bold`)
- `align`: Text align (default is `start`)
- `sep-thickness`: Thickness of the separator between title and body (default is `1pt`)
- `boxed-style`: If it's a dictionary of properties, indicates that the title must appear like a "floating box" above the showybox. If it's ``none``, the title appears normally (default is `none`)

#### Boxed styles

- `anchor`: Anchor of the boxed title
  - `y`: Vertical anchor (`top`, `horizon` or `bottom` -- default is `horizon`)
  - `x`: Horizontal anchor (`left`, `start`, `center`, `right`, `end` -- default is `start`)
- `offset`: How much to offset the boxed title in x and y direction as a dictionary with keys `x` and `y` (default is `0pt`)
- ``radius``: Boxed title radius as a dictionary or relative length (default is `5pt`)

### Body styles
- `color`: Text color (default is `black`)
- `align`: Text align (default is `start`)

### Footer styles
- `color`: Text color (default is `luma(85)`)
- `weight`: Text weight (default is `regular`)
- `align`: Text align (default is `start`)
- `sep-thickness`: Thickness of the separator between body and footer (default is `1pt`)

### Separator properties
- `thickness`: Separator's thickness (default is `1pt`)
- `dash`: Separator's style (as a `line` dash style, default is `"solid"`)
- `gutter`: Separator's space above and below (defalut is `0.65em`)

### Shadow properties
- `color`: Shadow color (default is `black`)
- `offset`: How much to offset the shadow in x and y direction either as a length or a dictionary with keys `x` and `y` (default is `4pt`)


## Gallery

### Colors for title, body and footer example (Stokes' theorem)

<h3 align="center">
  <img alt="Encapsulation" src="assets/stokes-example.png" style="max-width: 95%; background-color: #FFFFFF; padding: 10px 10px; box-shadow: 1pt 1pt 10pt 0pt #AAAAAA; border-radius: 4pt">
</h3>

### Boxed-title example (Clairaut's theorem)

<h3 align="center">
  <img alt="Encapsulation" src="assets/clairaut-example.png" style="max-width: 95%; background-color: #FFFFFF; padding: 10px 10px; box-shadow: 1pt 1pt 10pt 0pt #AAAAAA; border-radius: 4pt">
</h3>

### Encapsulation example

<h3 align="center">
  <img alt="Encapsulation" src="assets/encapsulation-example.png" style="max-width: 95%; background-color: #FFFFFF; padding: 10px 10px; box-shadow: 1pt 1pt 10pt 0pt #AAAAAA; border-radius: 4pt">
</h3>

### Breakable showybox example (Newton's second law)
<h3 align="center">
  <img alt="Enabling breakable" src="assets/newton-example.png" style="max-width: 95%; padding: 10px 10px; background-color: #FFFFFF; box-shadow: 1pt 1pt 10pt 0pt #AAAAAA; border-radius: 4pt">
</h3>

### Custom radius and title's separator thickness example (Carnot's cycle efficency)
<h3 align="center">
  <img alt="Custom radius" src="assets/carnot-example.png" style="max-width: 95%; background: #FFFFFF; padding: 10px 10px; box-shadow: 1pt 1pt 10pt 0pt #AAAAAA; border-radius: 4pt">
</h3>

### Custom border dash and inset example (Gauss's law)
<h3 align="center">
  <img alt="Custom radius" src="assets/gauss-example.png" style="max-width: 95%; background: #FFFFFF; padding: 10px 10px; box-shadow: 1pt 1pt 10pt 0pt #AAAAAA; border-radius: 4pt">
</h3>

### Custom footer's separator thickness example (Divergence's theorem)
<h3 align="center">
  <img alt="Custom radius" src="assets/divergence-example.png" style="max-width: 95%; background: #FFFFFF; padding: 10px 10px; box-shadow: 1pt 1pt 10pt 0pt #AAAAAA; border-radius: 4pt">
</h3>

### Colorful shadow example (Coulomb's law)
<h3 align="center">
  <img alt="Custom radius" src="assets/coulomb-example.png" style="max-width: 95%; background: #FFFFFF; padding: 10px 10px; box-shadow: 1pt 1pt 10pt 0pt #AAAAAA; border-radius: 4pt">
</h3>

## Changelog

### Version 2.0.4

_Special thanks to enklht (https://github.com/enklht) and PgBiel (https://github.com/PgBiel) for their collaboration with this version's changes_

- Change default alignments to ``start``, instead of ``left``
- Fix pre-rendering logic while creating boxed-titles
  - This fixes a reported bug occurring while creating a ``counter`` inside a showybox declaration

### Version 2.0.3
- Revert fix breakable box empty before new page. Layout didn't converge

### Version 2.0.2
- Remove deprecated functions in Typst 0.12.0
- Fix breakable box empty before new page

### Version 2.0.1

- Fix bad behaviours of boxed-titles ``anchor`` inside a ``figure``
- Fix wrong ``breakable`` behaviour of showyboxes inside a ``figure``
- Fix Manual and README's Stokes theorem example

### Version 2.0.0

_Special thanks to Andrew Voynov (<https://github.com/Andrew15-5>) for the feedback while creating the new behaviours for boxed-titles_

- Update ``type()`` conditionals to Typst 0.8.0 standards
- Add ``boxed-style`` property, with ``anchor``, ``offset`` and ``radius`` properties.
- Refactor ``showy-inset()`` for being general-purpose. Now it's called ``showy-value-in-direction()`` and has a default value for handling properties defaults
- Now sharp corners can be set by giving a dictionary to frame ``radius`` (e.g. ``radius: (top: 5pt, bottom: 0pt)``). Before this only was possible for untitled showyboxes.
- Refactor shadow functions to be in a separated file.
- Fix bug of bad behaviour while writing too long titles.
- Fix bug while rendering separators with custom thickness. Now the thickness is gotten properly.
- Fix bad shadow drawing in showyboxes with a boxed-title that has a "extreme" `offset` value.
- Fix bad sizing while creating showyboxes with a `width` of less than `100%`, and a shadow.

### Version 1.1.0
- Added `boxed` option in title styles
- Added `boxed-align` in title styles
- Added `sep-thickness` for title and footer
- Refactored repository's files layout

### Version 1.0.0

- Fixed shadow displacement
  - **Details:** Instead of displacing the showybox's body from the shadow, now the shadow is displaced from the body.

_Changes below were performed by Jonas Neugebauer (<https://github.com/jneug>)_

- Added `title-inset`, `body-inset`, `footer-inset` and `inset` options
	- **Details:** `title-inset`, `body-inset` and `footer-inset` will set the inset of the title, body and footer area respectively. `inset` is a fallback for those areas.
- Added a `sep.gutter` option to set the spacing around separator lines
- Added option `width` to set the width of a showybox
- Added option `align` to move a showybox with `width` < 100% along the x-axis
	- **Details:** A showybox is now wrapped in another block to allow alignment. This also makes it possible to pass the spacing options `spacing`, `above` and `below` to `#showybox()`.
- Added `footer` and `footer-style` options
	- **Details:** The optional footer is added at the bottom of the box.

### Version 0.2.1

_All changes listed here were performed by Jonas Neugebauer (<https://github.com/jneug>)_

- Added the `shadow` option
- Enabled auto-break (`breakable`) functionality for titled showyboxes
- Removed a thin line that appears in showyboxes with no borders or dashed borders

### Version 0.2.0
- Improved code documentation
- Enabled an auto-break functionality for non-titled showyboxes
- Created a separator functionality to separate content inside a showybox with a horizontal line

### Version 0.1.1
- Changed package name from colorbox to showybox
- Fixed a spacing bug in encapsulated showyboxes
  - **Details:** When a showybox was encapsulated inside another, the spacing after that showybox was `0pt`, probably due to some "fixes" improved to manage default spacing between `rect` elements. The issue was solved by avoiding `#set` statements and adding a `#v(-1.1em)` to correct extra spacing between the title `rect` and the body `rect`.

### Version 0.1.0
- Initial release