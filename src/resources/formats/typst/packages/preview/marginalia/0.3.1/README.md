# Marginalia

## Setup

Put something akin to the following at the start of your `.typ` file:

```typ
#import "@preview/marginalia:0.3.1" as marginalia: note, notefigure, wideblock

#show: marginalia.setup.with(
  // inner: ( far: 5mm, width: 15mm, sep: 5mm ),
  // outer: ( far: 5mm, width: 15mm, sep: 5mm ),
  // top: 2.5cm,
  // bottom: 2.5cm,
  // book: false,
  // clearance: 12pt,
)
```

If `book` is `false`, `inner` and `outer` correspond to the left and right
margins respectively. If book is true, the margins swap sides on even and odd
pages. Notes are placed in the outside margin by default.

Where you can then customize these options to your preferences. Shown here (as
comments) are the default values taken if the corresponding keys are unset.
[Please refer to the PDF documentation for more details on the configuration and the provided commands.](https://github.com/nleanba/typst-marginalia/blob/v0.3.1/Marginalia.pdf?raw=true)

Additionally, I recommend using Typst's partial function application feature to
customize other aspects of the notes consistently:

```typ
#let note = note.with(/* options here */)
#let notefigure = notefigure.with(/* same options here */)
```

## Margin-Notes

Provided via the `#note[...]` command.

_New in version 0.3.0:_ Notes can be labeled and referenced: If you write
`#note[]<xyz>`, then `@xyz` just works!

- `#note(side: "inner")[...]` to put it on the inside margin (left margin for
  single-sided documents).

  Also accepts: `auto`=`"outer"`, `"left"`, `"right"`.

- `#note(counter: none)[...]` to remove the marker.

  The display of the marker can be customized with the `numbering`,
  `anchor-numbering`, and `flush-numbering` parameters. Refer to the docs for
  details.

- `#note(shift: false)[...]` to force exact position of the note.

  Also accepts `auto` (behavior depends on whether it has a marker), `true`,
  `"avoid"` and `"ignore"`.

- And more options for fine control. All details are in the docs.

## Wide Blocks

Provided via the `#wideblock[...]` command.

- `#wideblock(side: "inner")[...]` to extend into the inside margin instead.

  Also accepts: `auto`=`"outer"`, `"left"`, `"right"`, or `"both"`.

Note: Wideblocks do not handle pagebreaks well, especially in `book: true`
documents. This is a limitation of Typst which does not (yet) provide a robust
way of detecting and reacting to page breaks.

## Figures

You can use figures as normal, also within wideblocks. To get captions on the
side, use

1. If you want top-aligned captions:

```typ
#set figure(gap: 0pt) // neccessary in both cases
#set figure.caption(position: top)
#show figure.caption.where(position: top): note.with(
  alignment: "top", counter: none, shift: "avoid", keep-order: true,
  dy: -0.01pt, // this is so that the caption is placed above wide figures.
)
```

2. If you want bottom-aligned captions:

```typ
#set figure(gap: 0pt) // neccessary in both cases
#set figure.caption(position: bottom) // (this is the default)
#show figure.caption.where(position: bottom): note.with(
  alignment: "bottom", counter: none, shift: "avoid", keep-order: true)
```

### Figures in the Margin

For small figures, the package also provides a `notefigure` command which places
the figure in the margin.

```typ
#notefigure(
  rect(width: 100%),
  caption: [A notefigure.],
)<figure-label>
```

It takes all the same options as `#note[]`, with some additions. In particular,

- You can use `#notefigure(note-label: <xyz>, ..)` to label the underlying note
  (if you want to reference it like a note)

- `#notefigure(show-caption: .., ..)` is how you change the caption rendering.
  NB.: this function is expected to take two arguments, please consult the docs.

## Utilities

- `#marginalia.header()` for easy two/three-column headers
- `#show: marginalia.show-frame` to show the page layout with background lines
- `#marginalia.note-numbering()` to generate your own numberings from sequences
  of symbols
- `#marginalia.ref()` to reference notes by relative index, without using
  labels.
- `#marginalia.get-left()` and `#marginalia.get-right()` to get contextual
  layout information.

## Manual

[Full Manual →](https://github.com/nleanba/typst-marginalia/blob/v0.3.1/Marginalia.pdf?raw=true)
[![first page of the documentation](https://github.com/nleanba/typst-marginalia/raw/refs/tags/v0.3.1/preview.svg)](https://github.com/nleanba/typst-marginalia/blob/v0.3.1/Marginalia.pdf?raw=true)

### Changelog

- 0.3.1
  - Text written right-to-left is now supported.
- 0.3.0
  - Notes and notefigures can now be labeled and referenced. The `label`
    parameter on notefigures has been removed, a `note-label` parameter has been
    added.
  - Recommended way to disable numbering a note is using `counter: none`, this
    now works uniformly for notes and notefigures. (Enable markers for a
    notefigure simply by using `counter: marginalia.notecounter`)
  - Note markers now link to the anchor (and vice versa). Controlled via new
    `link-anchor` property.
- 0.2.4
  - Pages with `height: auto` work now.
  - Added `ref` utility function.
- 0.2.3: The counter used for notes can now be customized.
- 0.2.2
  - More flexible `alignment` parameter replaces `align-baseline`.
    (`notefigure.dy` no longer takes a relative length, use `alignemnt`
    instead.)
  - Added `show-frame` and `header` utility functions.
- 0.2.1: Allow customizing the anchor independently of the in-note number using
  `anchor-numbering`.
- 0.2.0
  - `block-style` can now be a function, allowing to customize the style for
    even and odd pages.
  - `reverse` and `double` parameters have been replaced by a uniform `side`
    parameter.
  - Setup is now done using the `setup` show-rule. (`configure()` and
    `page-setup()` have been removed)
  - `numbering` and `flush-numbering` parameters are now per-note. (`numbered`
    has been removed.)
- 0.1.4: New styling parameter `block-style`.
- 0.1.3
  - New styling parameters `par-style`, and `text-style`.
  - Added `shift` and `keep-order` options.
- 0.1.1
  - Notes will now avoid each other for any amount of notes.
  - Added `notefigure`.
  - Added `clearance` configuration option.

(Not listing bugfixes, see the
[release notes on GitHub](https://github.com/nleanba/typst-marginalia/releases)
for the full details.)

## Feedback

Have you encountered a bug?
[Please report it as an issue in my GitHub repository.](https://github.com/nleanba/typst-marginalia/issues)

Has this package been useful to you?
[I am always happy when someone gives me a ~~sticker~~ star⭐](https://github.com/nleanba/typst-marginalia)
