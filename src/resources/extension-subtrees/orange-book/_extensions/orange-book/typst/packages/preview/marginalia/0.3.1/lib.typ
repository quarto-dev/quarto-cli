
/* Config Setup */

/// The default counter used for the note icons.
///
/// If you use @note-numbering without @note-numbering.repeat, it is recommended you reset this occasionally, e.g. per heading or per page.
/// #example(scale-preview: 100%, ```typc notecounter.update(1)```)
/// -> counter
#let notecounter = counter("marginalia-note")

/// Icons to use for note markers.
///
/// ```typc ("◆", "●", "■", "▲", "♥", "◇", "○", "□", "△", "♡")```
#let note-markers = ("◆", "●", "■", "▲", "♥", "◇", "○", "□", "△", "♡")
/// Icons to use for note markers, alternating filled/outlined.
///
/// ```typc ("●", "○", "◆", "◇", "■", "□", "▲", "△", "♥", "♡")```
#let note-markers-alternating = ("●", "○", "◆", "◇", "■", "□", "▲", "△", "♥", "♡")

/// Format note marker.
/// -> content
#let note-numbering(
  /// #example(```typ
  /// #for i in array.range(1,15) {
  ///   note-numbering(markers: note-markers, i) }
  ///
  /// #for i in array.range(1,15) {
  ///   note-numbering(markers: note-markers-alternating, i) }
  ///
  /// #for i in array.range(1,15) {
  ///   note-numbering(markers: (), i) }
  /// ```)
  /// -> array
  markers: note-markers-alternating,
  /// Whether to (```typc true```) loop over the icons, or (```typc false```) continue with numbers after icons run out.
  /// #example(```typ
  /// #for i in array.range(1,15) {
  ///   note-numbering(repeat: true, i) }
  ///
  /// #for i in array.range(1,15) {
  ///   note-numbering(repeat: false, i) }
  /// ```)
  /// -> bool
  repeat: true,
  /// Wrap the symbol in a styled text function.
  /// -> function
  style: text.with(weight: 900, font: "Inter", size: 5pt, style: "normal", fill: rgb(54%, 72%, 95%)),
  /// Whether to add a space of 2pt after the symbol.
  /// If ```typc auto```, a space is only added if it is a number (the symbols have ran out).
  /// -> auto | bool
  space: auto,
  ..,
  /// -> int
  i,
) = {
  let index = if repeat and markers.len() > 0 { calc.rem(i - 1, markers.len()) } else { i - 1 }
  let symbol = if index < markers.len() {
    markers.at(index)
    if space == true { h(2pt) }
  } else {
    str(index + 1 - markers.len())
    if space == true or space == auto { h(2pt) }
  }
  style(symbol)
}

///#internal()
#let _fill_config(..config) = {
  let config = config.named()
  // default margins a4 are 2.5 cm
  let inner = config.at("inner", default: (far: 5mm, width: 15mm, sep: 5mm))
  let outer = config.at("outer", default: (far: 5mm, width: 15mm, sep: 5mm))
  return (
    inner: (
      far: inner.at("far", default: 5mm),
      width: inner.at("width", default: 15mm),
      sep: inner.at("sep", default: 5mm),
    ),
    outer: (
      far: outer.at("far", default: 5mm),
      width: outer.at("width", default: 15mm),
      sep: outer.at("sep", default: 5mm),
    ),
    top: config.at("top", default: 2.5cm),
    bottom: config.at("bottom", default: 2.5cm),
    book: config.at("book", default: false),
    clearance: config.at("clearance", default: 12pt),
  )
}

#let _config = state("_config", _fill_config())

/// Page setup helper
///
/// This will generate a dictionary ```typc ( margin: .. )``` compatible with the passed config.
/// This can then be spread into the page setup like so:
///```typ
/// #set page( ..page-setup(..config) )```
///
/// Takes the same options as @setup.
/// -> dictionary
#let _page-setup(
  /// Missing entries are filled with package defaults. Note: missing entries are _not_ taken from the current marginalia config, as this would require context.
  /// -> dictionary
  ..config,
) = {
  let config = _fill_config(..config)
  if config.book {
    return (
      binding: left,
      margin: (
        inside: config.inner.far + config.inner.width + config.inner.sep,
        outside: config.outer.far + config.outer.width + config.outer.sep,
        top: config.top,
        bottom: config.bottom,
      ),
    )
  } else {
    return (
      binding: left,
      margin: (
        left: config.inner.far + config.inner.width + config.inner.sep,
        right: config.outer.far + config.outer.width + config.outer.sep,
        top: config.top,
        bottom: config.bottom,
      ),
    )
  }
}

/// This will update the marginalia config and setup the page with the provided config options.
/// (This means this will insert a pagebreak.)
///
/// Use as
/// ```typ
/// #show: marginalia.setup.with(/* options here */)
/// ```
///
/// The default values for the margins have been chosen such that they match the default typst margins for a4. It is strongly recommended to change at least one of either `inner` or `outer` to be wide enough to actually contain text.
///
/// This function also sets up the neccesary show-rule to allow referencing labelled notes.
/// If you also have a custom ```typ #show ref:``` rule, it may be relevant if setup is called before or after that show rule.
///
/// #compat((
///   "0.1.5": (
///     [`numbering` has been replaced with @note.numbering/@notefigure.numbering.
///      #ergo[set \````typc numbering: /**/```\` directly on your notes instead of via @setup.\ Use ```typ #let note = note.with(numbering: /**/)``` for consistency.]],
///     [`flush-numbers` has been replaced by @note.flush-numbering.
///      #ergo[set \````typc flush-numbering: true```\` directly on your notes instead of via @setup.\ Use ```typ #let note = note.with(flush-numbering: /**/)``` for consistency.]],
///   ),
///   "0.2.0": (
///     [This function does no longer apply the configuration partially, but will reset all unspecified options to the default.
///      Additionally, it replaces the `page-setup()` function that was needed previously and is no longer called `configure()`],
///   ),
/// ))
#let setup(
  /// Inside/left margins.
  ///     - `far`: Distance between edge of page and margin (note) column.
  ///     - `width`: Width of the margin column.
  ///     - `sep`: Distance between margin column and main text column.
  ///
  /// The page inside/left margin should equal `far` + `width` + `sep`.
  ///
  /// If partial dictionary is given, it will be filled up with defaults.
  /// -> dictionary
  inner: (far: 5mm, width: 15mm, sep: 5mm),
  /// Outside/right margins. Analogous to `inner`.
  /// -> dictionary
  outer: (far: 5mm, width: 15mm, sep: 5mm),
  /// Top margin.
  /// -> length
  top: 2.5cm,
  /// Bottom margin.
  /// -> length
  bottom: 2.5cm,
  ///- If ```typc true```, will use inside/outside margins, alternating on each page.
  ///- If ```typc false```, will use left/right margins with all pages the same.
  /// -> bool
  book: false,
  /// Minimal vertical distance between notes and to wide blocks.
  /// -> length
  clearance: 12pt,
  /// -> content
  body,
) = { }
#let setup(..config, body) = {
  _config.update(_fill_config(..config))
  set page(.._page-setup(..config))
  show ref: it => {
    if (
      it.has("element")
        and it.element != none
        and it.element.has("children")
        and it.element.children.len() > 1
        and it.element.children.first().func() == metadata
    ) {
      if it.element.children.first().value == "_marginalia_note" {
        h(0pt, weak: true)
        show link: it => {
          show underline: i => i.body
          it
        }
        let dest = query(selector(<_marginalia_note>).after(it.element.location()))
        assert(dest.len() > 0, message: "Could not find referenced note")
        link(dest.first().location(), dest.first().value.anchor)
      } else if it.element.children.first().value == "_marginalia_notefigure" {
        let dest = query(selector(<_marginalia_notefigure_meta>).after(it.element.location()))
        assert(dest.len() > 0, message: "Could not find referenced notefigure")
        if it.has("form") {
          std.ref(dest.first().value.label, form: it.form, supplement: it.supplement)
        } else {
          std.ref(dest.first().value.label, supplement: it.supplement)
        }
      } else {
        it
      }
    } else {
      it
    }
  }
  body
}

/// // #internal[(mostly for internal use)]
/// Returns a dictionary with the keys `far`, `width`, `sep` containing the respective widths of the
/// left margin on the current page. (On both even and odd pages.)
///
/// Requires context.
/// -> dictionary
#let get-left() = {
  let config = _config.get()
  if not (config.book) or calc.odd(here().page()) {
    return config.inner
  } else {
    return config.outer
  }
}

/// // #internal[(mostly for internal use)]
/// Returns a dictionary with the keys `far`, `width`, `sep` containing the respective widths of the
/// right margin on the current page. (On both even and odd pages.)
///
/// Requires context.
/// -> dictionary
#let get-right() = {
  let config = _config.get()
  if not (config.book) or calc.odd(here().page()) {
    return config.outer
  } else {
    return config.inner
  }
}

/// Adds lines to the page background showing the various vertical and horizontal boundaries used by marginalia.
///
/// To be used in a show-rule:
/// ```typ
/// #show: marginalia.show-frame
/// ```
/// -> content
#let show-frame(
  /// Stroke for the lines.
  ///
  /// ```typ
  /// #show: marginalia.show-frame.with(stroke: 2pt + red)
  /// ```
  /// -> color
  stroke: 0.5pt + luma(90%),
  /// Set to false to hide the header line
  /// -> bool
  header: true,
  /// Set to false to hide the footer line
  /// -> bool
  footer: true,
  /// -> content
  body,
) = {
  set page(
    background: context {
      let leftm = get-left()
      let rightm = get-right()

      let topm = _config.get().top
      let ascent = page.header-ascent.ratio * topm + page.header-ascent.length
      place(top, dy: topm, line(length: 100%, stroke: stroke))
      if header {
        place(top, dy: topm - ascent, line(length: 100%, stroke: stroke))
      }

      let bottomm = _config.get().bottom
      let descent = page.footer-descent.ratio * bottomm + page.footer-descent.length
      place(bottom, dy: -bottomm, line(length: 100%, stroke: stroke))
      if footer {
        place(bottom, dy: -bottomm + descent, line(length: 100%, stroke: stroke))
      }

      place(left, dx: leftm.far, rect(width: leftm.width, height: 100%, stroke: (x: stroke)))
      place(left, dx: leftm.far + leftm.width + leftm.sep, line(length: 100%, stroke: stroke, angle: 90deg))

      place(right, dx: -rightm.far, rect(width: rightm.width, height: 100%, stroke: (x: stroke)))
      place(right, dx: -rightm.far - rightm.width - rightm.sep, line(length: 100%, stroke: stroke, angle: 90deg))
    },
  )

  body
}

/// #internal[(mostly for internal use)]
/// Calculates positions for notes.
///
/// Return type is of the form `(<index/id>: offset)`
/// -> dictionary
#let _calculate-offsets(
  /// Of the form
  /// ```typc
  /// (
  ///   height: length, // total page height
  ///   top: length,    // top margin
  ///   bottom: length, // bottom margin
  /// )
  /// ```
  /// -> dictionary
  page,
  /// Of the form `(<index/id>: item)` where items have the form
  /// ```typc
  /// (
  ///   natural: length,    // initial vertical position of item, relative to page
  ///   height: length,     // vertical space needed for item
  ///   clearance: length,  // vertical padding required.
  ///                       // may be collapsed at top & bottom of page, and above separators
  ///   shift: bool | "ignore" | "avoid", // whether the item may be moved about. `auto` = move only if neccessary
  ///   keep-order: bool,   // if false, may be reordered. if true, order relative to other `false` items is kept
  /// )
  /// ```
  /// -> dictionary
  items,
  /// -> length
  clearance,
) = {
  // sorting
  let ignore = ()
  let reoderable = ()
  let nonreoderable = ()
  for (key, item) in items.pairs() {
    if item.shift == "ignore" {
      ignore.push(key)
    } else if item.keep-order == false {
      reoderable.push((key, item.natural))
    } else {
      nonreoderable.push((key, item.natural))
    }
  }
  reoderable = reoderable.sorted(key: ((_, pos)) => pos)

  let positions = ()

  let index_r = 0
  let index_n = 0
  while index_r < reoderable.len() and index_n < nonreoderable.len() {
    if reoderable.at(index_r).at(1) <= nonreoderable.at(index_n).at(1) {
      positions.push(reoderable.at(index_r))
      index_r += 1
    } else {
      positions.push(nonreoderable.at(index_n))
      index_n += 1
    }
  }
  while index_n < nonreoderable.len() {
    positions.push(nonreoderable.at(index_n))
    index_n += 1
  }
  while index_r < reoderable.len() {
    positions.push(reoderable.at(index_r))
    index_r += 1
  }

  // shift down
  let cur = page.top
  let empty = 0pt
  let prev-shift-avoid = false
  let positions_d = ()
  for (key, position) in positions {
    let fault = cur - position
    if cur <= position {
      positions_d.push((key, position))
      if items.at(key).shift == false {
        empty = 0pt
      } else {
        empty += position - cur
      }
      cur = position + items.at(key).height + clearance
    } else if items.at(key).shift == "avoid" {
      if fault <= empty {
        if prev-shift-avoid {
          positions_d.push((key, cur))
          cur = cur + items.at(key).height + clearance
        } else {
          // can stay
          positions_d.push((key, position))
          empty -= fault // ?
          cur = position + items.at(key).height + clearance
        }
      } else {
        if prev-shift-avoid {
          positions_d.push((key, cur))
          cur = cur + items.at(key).height + clearance
        } else {
          positions_d.push((key, position + fault - empty))
          cur = position + fault - empty + items.at(key).height + clearance
          empty = 0pt
        }
      }
    } else if items.at(key).shift == false {
      // check if we can swap with previous
      if (
        positions_d.len() > 0
          and fault > empty
          and items.at(positions_d.last().at(0)).shift != false
          and ((not items.at(key).keep-order) or (not items.at(positions_d.last().at(0)).keep-order))
      ) {
        let (prev, _) = positions_d.pop()
        cur -= items.at(prev).height
        positions_d.push((key, position))
        empty = 0pt
        let new_x = calc.max(position + items.at(key).height + clearance, cur)
        cur = new_x
        positions_d.push((prev, cur))
        cur = cur + items.at(prev).height + clearance
      } else {
        positions_d.push((key, position))
        empty = 0pt
        cur = calc.max(position + items.at(key).height + clearance, cur)
      }
    } else {
      positions_d.push((key, cur))
      empty += 0pt
      // empty = 0pt
      cur = cur + items.at(key).height + clearance
    }
    prev-shift-avoid = items.at(key).shift == "avoid"
  }

  let positions = ()

  let max = if page.height == auto {
    if positions_d.len() > 0 {
      let (key, position) = positions_d.at(-1)
      position + items.at(key).height
    } else { 0pt }
  } else {
    page.height - page.bottom
  }
  for (key, position) in positions_d.rev() {
    if max > position + items.at(key).height {
      positions.push((key, position))
      max = position - clearance
    } else if items.at(key).shift == false {
      positions.push((key, position))
      max = calc.min(position - clearance, max)
    } else {
      positions.push((key, max - items.at(key).height))
      max = max - items.at(key).height - clearance
    }
  }

  let result = (:)
  for (key, position) in positions {
    result.insert(key, position - items.at(key).natural)
  }
  for key in ignore {
    result.insert(key, 0pt)
  }
  result
}

// #let _parent-note = state("_marginalia_parent-note-natural", false)

#let _note_extends_left = state("_note_extends_left", (:))
// #let _note_offsets_left = state("_note_offsets_left", (:))

#let _note_extends_right = state("_note_extends_right", (:))
// #let _note_offsets_right = state("_note_offsets_right", (:))


// Internal use.
// Requires Context.
// -> "left" | "right"
#let _get-near-side() = {
  let anchor = here().position()
  let pagewidth = if page.flipped { page.height } else { page.width }
  let left = get-left()
  let right = get-right()
  if (
    anchor.x - left.far - left.width - left.sep
      < (pagewidth - left.far - left.width - left.sep - right.far - right.width - right.sep) / 2
  ) {
    "left"
  } else {
    "right"
  }
}

// Internal use.
#let place-note(
  /// -> "right" | "left" | "near"
  side: "right",
  dy: 0pt,
  keep-order: false,
  shift: true,
  body,
) = (
  box(
    width: 0pt,
    context {
      assert(side == "left" or side == "right" or side == "near", message: "side must be left or right.")

      let dy = dy.to-absolute()
      let anchor = here().position()
      let pagewidth = if page.flipped { page.height } else { page.width }
      let page_num = str(anchor.page)

      let side = if side == "near" { _get-near-side() } else { side }

      let width = if side == "left" { get-left().width } else { get-right().width }
      let height = measure(body, width: width).height
      let notebox = box(width: width, height: height, body)
      let natural_position = anchor.y + dy

      let extends = if side == "right" { _note_extends_right } else { _note_extends_left }
      // let offsets = if side == "right" { _note_offsets_right } else { _note_offsets_left }

      let current = extends.get().at(page_num, default: ())
      let index = current.len()

      extends.update(old => {
        let oldpage = old.at(page_num, default: ())
        oldpage.push((natural: natural_position, height: height, shift: shift, keep-order: keep-order))
        old.insert(page_num, oldpage)
        old
      })

      let offset_page = (
        height: if page.flipped { page.width } else { page.height },
        bottom: _config.get().bottom,
        top: _config.get().top,
      )
      let offset_items = extends
        .final()
        .at(page_num, default: ())
        .enumerate()
        .map(((key, item)) => (str(key), item))
        .to-dict()
      let offset_clearance = _config.get().clearance
      let dbg = _calculate-offsets(offset_page, offset_items, offset_clearance)
      // TODO: trying to cache the results does not work.
      // offsets.update(old => {
      //   // only do calculations if not yet in old
      //   if page_num in old {
      //     old
      //   } else {
      //     let new_offsets = _calculate-offsets(offset_page, offset_items, offset_clearance)
      //     assert(dbg == new_offsets)
      //     old.insert(page_num, new_offsets)
      //     old
      //   }
      // })

      // let vadjust = dy + offsets.final().at(page_num, default: (:)).at(str(index), default: 0pt)
      let vadjust = dy + dbg.at(str(index), default: 0pt)

      // box(width: 0pt, place(box(fill: yellow, width: 1cm, text(size: 5pt)[#anchor.y + #vadjust = #(anchor.y + vadjust)])))

      let hadjust = if side == "left" { get-left().far - anchor.x } else {
        pagewidth - anchor.x - get-right().far - get-right().width
      }

      place(left, dx: hadjust, dy: vadjust, notebox)
    },
  )
)

/// Create a marginnote.
/// Will adjust it's position downwards to avoid previously placed notes, and upwards to avoid extending past the bottom margin.
///
/// Notes can be attached a label and are referenceable (if @setup was run).
///
/// #compat((
///   "0.1.5": (
///     [`reverse` has been replaced with @note.side.
///      #ergo[use \````typc side: "inner"```\` instead of \````typc reverse: true```\`]],
///     [`numbered` has been replaced with @note.numbering.
///      #ergo[use \````typc numbering: "none"```\` instead of \````typc numbered: false```\`]],
///   ),
///   "0.2.2": (
///     [`align-baseline` has been replaced with @note.alignment.
///      #ergo[use \````typc alignment: "top"```\` instead of \````typc align-baseline: false```\`]],
///   ),
/// ))
#let note(
  /// Counter to use for this note.
  /// Can be set to ```typc none``` do disable numbering this note.
  ///
  /// Will only be stepped if `numbering` is not ```typc none```.
  /// -> counter | none
  counter: notecounter,
  /// Function or `numbering`-string to generate the note markers from the `notecounter`.
  /// - If ```typc none```, will not step the `counter`.
  /// - Will be ignored if `counter` is ```typc none```.
  ///
  /// Examples:
  /// - ```typc (..i) => super(numbering("1", ..i))``` for superscript numbers
  ///   #note(numbering: (..i) => super(numbering("1", ..i)))[E.g.]
  /// - ```typc (..i) => super(numbering("a", ..i))``` for superscript letters
  ///   #note(numbering: (..i) => super(numbering("a", ..i)))[E.g.]
  /// - ```typc marginalia.note-numbering.with(repeat: false, markers: ())``` for small blue numbers
  ///   #note(numbering: marginalia.note-numbering.with(repeat: false, markers: ()))[E.g.]
  /// -> none | function | string
  numbering: note-numbering,
  /// Used to generate the marker for the anchor (i.e. the one in the surrounding text)
  ///
  /// - If ```typc auto```, will use the given @note.numbering.
  /// - Will be ignored if `counter` is ```typc none```.
  /// -> none | auto | function | string
  anchor-numbering: auto,
  /// Whether to have the anchor link to the note, and vice-versa.
  /// -> bool
  link-anchor: true,
  /// Disallow note markers hanging into the whitespace.
  /// - If ```typc auto```, acts like ```typc false``` if @note.anchor-numbering is ```typc auto```.
  /// -> auto | bool
  flush-numbering: auto,
  /// Which side to place the note.
  /// ```typc auto``` defaults to ```typc "outer"```.
  /// In non-book documents, ```typc "outer"```/```typc "inner"``` are equivalent to ```typc "right"```/```typc "left"``` respectively.
  /// ```typc "near"``` will place the note in the left or right margin, depending which is nearer.
  /// -> auto | "outer" | "inner" | "left" | "right" | "near"
  side: auto,
  /// Vertical alignment of the note.
  /// #let note = note.with(block-style: (outset: (left: 5cm), fill: oklch(70%, 0.1, 120deg, 20%)), shift: "ignore")
  /// - ```typc "bottom"``` aligns the bottom edge of the note with the main text baseline.#note(alignment: "bottom")[Bottom\ ...]
  /// - ```typc "baseline"``` aligns the first baseline of the note with the main text baseline.#note(alignment: "baseline")[Baseline\ ...]
  /// - ```typc "top"``` aligns the top edge of the note with the main text baseline.#note(alignment: "top")[Top\ ...]
  ///
  /// -> "baseline" | "top" | "bottom"
  alignment: "baseline",
  /// Inital vertical offset of the note, relative to the alignment point.
  /// The note may get shifted still to avoid other notes depending on @note.shift.
  /// -> length
  dy: 0pt,
  /// Notes with ```typc keep-order: true``` are not re-ordered relative to one another.
  ///
  /// // If ```typc auto```, defaults to false unless ```typc numbering``` is ```typc none``.
  /// // -> bool | auto
  /// -> bool
  keep-order: false,
  /// Whether the note may get shifted vertically to avoid other notes.
  /// - ```typc true```: The note may shift to avoid other notes, wide-blocks and the top/bottom margins.
  /// - ```typc false```: The note is placed exactly where it appears, and other notes may shift to avoid it.
  /// - ```typc "avoid"```: The note is only shifted if shifting other notes is not sufficent to avoid a collision.
  ///   E.g. if it would collide with a wideblock or a note with ```typc shift: false```.
  /// - ```typc "ignore"```: Like ```typc false```, but other notes do not try to avoid it.
  /// - ```typc auto```: ```typc true``` if numbered, ```typc "avoid"``` otherwise.
  /// -> bool | auto | "avoid" | "ignore"
  shift: auto,
  /// Will be used to ```typc set``` the text style.
  /// -> dictionary
  text-style: (size: 9.35pt, style: "normal", weight: "regular"),
  /// Will be used to ```typc set``` the par style.
  /// -> dictionary
  par-style: (spacing: 1.2em, leading: 0.5em, hanging-indent: 0pt),
  /// Will be passed to the `block` containing the note body.
  /// If this is a function, it will be called with ```typc "left"``` or ```typc "right"``` as its argument, and the result is passed to the `block`.
  /// -> dictionary | function
  block-style: (width: 100%),
  /// -> content
  body,
) = {
  metadata("_marginalia_note")

  let numbering = if counter == none { none } else { numbering }
  if numbering != none { counter.step() }
  let flush-numbering = if flush-numbering == auto { anchor-numbering != auto } else { flush-numbering }
  let anchor-numbering = if anchor-numbering == auto { numbering } else { anchor-numbering }

  // let keep-order = if keep-order == auto { not numbered } else { keep-orders }
  let shift = if shift == auto { if numbering != none { true } else { "avoid" } } else { shift }

  let text-style = (size: 9.35pt, style: "normal", weight: "regular", ..text-style)
  let par-style = (spacing: 1.2em, leading: 0.5em, hanging-indent: 0pt, ..par-style)

  context {
    let side = if side == "outer" or side == auto {
      if _config.get().book and calc.even(here().page()) { "left" } else { "right" }
    } else if side == "inner" {
      if _config.get().book and calc.even(here().page()) { "right" } else { "left" }
    } else { side }

    assert(
      side == "left" or side == "right" or side == "near",
      message: "side must be auto, left, right, near, outer, or inner.",
    )
    let body = if numbering != none {
      let number = {
        if link-anchor {
          show link: it => {
            show underline: i => i.body
            it
          }
          link(here(), counter.display(numbering))
        } else {
          counter.display(numbering)
        }
      }
      if flush-numbering {
        box(number)
        h(0pt, weak: true)
        body
      } else {
        body
        let width = measure({
          set text(..text-style)
          set par(..par-style)
          number
        }).width
        if width < 8pt { width = 8pt }
        place(
          top + start,
          {
            h(-width) // HACK: uses `h` instad of `dx` so it works in ltr and rtl contexts
            box(
              width: width,
              {
                h(1fr)
                sym.zws
                number
                h(1fr)
              },
            )
          },
        )
      }
    } else {
      body
    }

    let block-style = if type(block-style) == function {
      block-style(side)
    } else {
      block-style
    }

    let anchor = if anchor-numbering != none and counter != none {
      counter.display(anchor-numbering)
    } else []

    let body = align(
      top,
      block(
        width: 100%,
        ..block-style,
        align(
          start,
          {
            // HACK: inner align ensures text-direction is unaffected by `place(left,..)`
            set text(..text-style)
            set par(..par-style)
            [#metadata((note: true, anchor: anchor))<_marginalia_note>#body]
          },
        ),
      ),
    )

    let dy-adjust = if alignment == "baseline" {
      measure(text(..text-style, sym.zws)).height
    } else if alignment == "top" {
      0pt
    } else if alignment == "bottom" {
      let width = if side == "left" {
        get-left().width
      } else {
        get-right().width
      }
      measure(width: width, body).height
    } else {
      panic("Unknown value for alignment")
    }
    let dy = dy - dy-adjust

    h(0pt, weak: true)
    box({
      if anchor-numbering != none {
        if link-anchor {
          show link: it => {
            show underline: i => i.body
            it
          }
          let dest = query(selector(<_marginalia_note>).after(here()))
          if dest.len() > 0 {
            link(dest.first().location(), anchor)
          } else {
            anchor
          }
        } else {
          anchor
        }
      }
      place-note(side: side, dy: dy, keep-order: keep-order, shift: shift, body)
    })
  }
}

/// Reference a nearby margin note. Will place the same anchor as that note had.
///
/// Be aware that notes without an anchor (including notefigures) still count for the offset, but the rendered link is empty.
///
/// #example(scale-preview: 100%, ```typ
///   This is a note: #note[Blah Blah]
///
///   This is a link to that note:
///     #marginalia.ref(-1)
///
///   This is an unnumbered note:
///     #note(counter: none)[Blah Blah]
///
///   This is a useless link to that note:
///     #marginalia.ref(-1)
///   ```)
#let ref(
  /// How many notes away the target note is.
  /// - ```typc -1```: The previous note.
  /// - ```typc 0```: Disallowed
  /// - ```typc 1```: The next note.
  /// -> integer
  offset,
) = context {
  h(0pt, weak: true)
  show link: it => {
    show underline: i => i.body
    it
  }
  assert(offset != 0, message: "marginalia.ref offset must not be 0.")
  if offset > 0 {
    let dest = query(selector(<_marginalia_note>).after(here()))
    assert(dest.len() > offset, message: "Not enough notes after this to reference")
    link(dest.at(offset - 1).location(), dest.at(offset - 1).value.anchor)
  } else {
    let dest = query(selector(<_marginalia_note>).before(here()))
    assert(dest.len() >= -offset, message: "Not enough notes before this to reference")
    link(dest.at(offset).location(), dest.at(offset).value.anchor)
  }
}

/// Creates a figure in the margin.
///
/// Parameters `numbering`, `anchor-numbering`, `flush-numbering`, `side`, `keep-order`, `shift`, `text-style`, `par-style`, and `block-style` work the same as for @note.
///
/// Notefigures can be attached a label and are referenceable (if @setup was run). Furthermore, the underlying @note can be given a label using the `note-label` parameter.
///
/// #compat((
///   "0.1.5": (
///     [`reverse` has been replaced with @notefigure.side.
///      #ergo[use \````typc side: "inner"```\` instead of \````typc reverse: true```\`]],
///     [`numbered` has been replaced with @notefigure.numbering.
///      #ergo[use \````typc numbering: marginalia.note-numbering```\` instead of \````typc numbered: true```\`]],
///   ),
///   "0.2.2": (
///     [@notefigure.dy no longer takes a relative length, instead @notefigure.alignment was added.],
///   ),
///   "0.3.0": (
///     [The `label` argument has been removed.
///      #ergo[Instead of ```typ #notefigure(label: <l>, ..)```, use ```typ #notefigure(..)<l>```.]],
///   )
/// ))
/// -> content
#let notefigure(
  /// Same as @note.numbering, but with different default.
  /// Set this to `marginalia.notecounter` (or another counter) to enable numbering this note.
  ///
  /// Will only be stepped if `numbering` is not ```typc none```.
  ///
  /// #example(scale-preview: 100%, dir: ttb, ```typ
  /// Notefigure with marker:
  /// #notefigure(rect(height: 10pt, width: 100%), caption: [...], counter: marginalia.notecounter)
  /// ```)
  /// #example(scale-preview: 100%, dir: ttb, ```typ
  /// Using the figure counter for the numbering:
  /// #notefigure(
  ///   rect(height: 10pt, width: 100%), caption: [...],
  ///   counter: counter(figure.where(kind: image)),
  ///   anchor-numbering: (.., i) => super[fig. #numbering("1", i+1)], numbering: none,
  /// )
  /// ```)
  /// -> counter | none
  counter: none,
  /// Same as @note.numbering.
  /// -> none | function | string
  numbering: note-numbering,
  /// Same as @note.anchor-numbering.
  /// -> none | auto | function | string
  anchor-numbering: auto,
  /// Whether to have the anchor link to the note, and vice-versa.
  /// -> bool
  link-anchor: true,
  /// Disallow note markers hanging into the whitespace.
  /// - If ```typc auto```, acts like ```typc false``` if @notefigure.anchor-numbering is ```typc auto```.
  /// -> auto | bool
  flush-numbering: auto,
  /// Which side to place the note.
  /// ```typc auto``` defaults to ```typc "outer"```.
  /// In non-book documents, ```typc "outer"```/```typc "inner"``` are equivalent to ```typc "right"```/```typc "left"``` respectively.
  /// -> auto | "outer" | "inner" | "left" | "right" | "near"
  side: auto,
  /// Vertical alignment of the notefigure.
  /// #let notefigure = notefigure.with(shift: "ignore", show-caption: (number, caption) => block(outset: (left: 5cm), width: 100%, fill: oklch(70%, 0.1, 120deg, 20%), {
  ///   number; caption.supplement; [ ]; caption.counter.display(caption.numbering); caption.separator; caption.body
  /// }))
  /// - ```typc "top"```, ```typc "bottom"``` work the same as @note.alignment.
  /// - ```typc "baseline"``` aligns the first baseline of the _caption_ with the main text baseline.
  ///   #notefigure(rect(width: 100%, height: 2pt, stroke: 0.5pt + gray), alignment: "baseline", caption: [Baseline])
  /// - ```typc "caption-top"``` aligns the top of the caption with the main text baseline.
  ///   #notefigure(rect(width: 100%, height: 2pt, stroke: 0.5pt + gray), alignment: "caption-top", caption: [Caption-top])
  ///
  /// -> "baseline" | "top" | "bottom" | "caption-top"
  alignment: "baseline",
  /// Inital vertical offset of the notefigure, relative to the alignment point.
  ///
  /// The notefigure may get shifted still to avoid other notes depending on ```typc notefigure.shift```.
  /// -> length
  dy: 0pt,
  /// -> bool
  keep-order: false,
  /// -> bool | auto | "avoid" | "ignore"
  shift: auto,
  /// Will be used to ```typc set``` the text style.
  /// -> dictionary
  text-style: (size: 9.35pt, style: "normal", weight: "regular"),
  /// Will be used to ```typc set``` the par style.
  /// -> dictionary
  par-style: (spacing: 1.2em, leading: 0.5em, hanging-indent: 0pt),
  /// Will be passed to the `block` containing the note body (this contains the entire figure).
  /// If this is a function, it will be called with ```typc "left"``` or ```typc "right"``` as its argument, and the result is passed to the `block`.
  /// -> dictionary | function
  block-style: (width: 100%),
  /// A function with two arguments, the (note-)number and the caption.
  /// Will be called as the caption show rule.
  ///
  /// If @notefigure.numbering is ```typc none```, `number` will be ```typc none```.
  /// -> function
  show-caption: (number, caption) => {
    number
    caption.supplement
    [ ]
    caption.counter.display(caption.numbering)
    caption.separator
    caption.body
  },
  /// Pass-through to ```typ #figure()```, but used to adjust the vertical position.
  /// -> length
  gap: 0.55em,
  /// A label to attach to the note. Referencing this label will repeat the anchor,
  /// so it is only really useful if @notefigure.anchor-numbering is not ```typc none```.
  /// -> none | label
  note-label: none,
  /// The figure content, e.g.~an image. Pass-through to ```typ #figure()```, but used to adjust the vertical position.
  /// -> content
  content,
  /// Pass-through to ```typ #figure()```.
  ///
  /// (E.g. `caption`)
  /// -> arguments
  ..figureargs,
) = {
  [#metadata("_marginalia_notefigure")<_marginalia_notefigure>]

  let numbering = if counter == none { none } else { numbering }
  if numbering != none { counter.step() }
  let flush-numbering = if flush-numbering == auto { anchor-numbering != auto } else { flush-numbering }
  let anchor-numbering = if anchor-numbering == auto { numbering } else { anchor-numbering }

  let shift = if shift == auto { if numbering != none { true } else { "avoid" } } else { shift }

  let text-style = (size: 9.35pt, style: "normal", weight: "regular", ..text-style)
  let par-style = (spacing: 1.2em, leading: 0.5em, hanging-indent: 0pt, ..par-style)

  context {
    let number = if counter != none and numbering != none {
      if link-anchor {
        show link: it => {
          show underline: i => i.body
          it
        }
        link(here(), counter.display(numbering))
      } else {
        counter.display(numbering)
      }
    } else { none }
    let number-width = if numbering != none and not flush-numbering {
      let width = measure({
        set text(..text-style)
        set par(..par-style)
        number
      }).width
      if width < 8pt { 8pt } else { width }
    } else { 0pt }

    set figure.caption(position: bottom)
    show figure.caption: it => {
      set align(left)
      if numbering != none {
        context if flush-numbering {
          show-caption(
            number,
            it,
          )
        } else {
          show-caption(
            place(
              // top + left,
              left,
              dx: -number-width,
              box(
                width: number-width,
                {
                  h(1fr)
                  sym.zws
                  number
                  h(1fr)
                },
              ),
            ),
            it,
          )
        }
      } else {
        context show-caption(none, it)
      }
    }

    let side = if side == "outer" or side == auto {
      if _config.get().book and calc.even(here().page()) { "left" } else { "right" }
    } else if side == "inner" {
      if _config.get().book and calc.even(here().page()) { "right" } else { "left" }
    } else if side == "near" {
      _get-near-side()
    } else {
      side
    }

    let width = if side == "left" {
      get-left().width
    } else {
      get-right().width
    }
    let height = (
      measure(
        width: width,
        {
          set text(..text-style)
          set par(..par-style)
          content
        },
      ).height
        + measure(text(..text-style, v(gap))).height
    )
    let baseline-height = measure(text(..text-style, sym.zws)).height
    let alignment = alignment
    let dy = dy
    if alignment == "baseline" {
      alignment = "top"
      dy = dy - height - baseline-height
    } else if alignment == "caption-top" {
      alignment = "top"
      dy = dy - height
    }

    let index = query(selector(<_marginalia_notefigure>).before(here())).len()
    let figure-label = std.label("_marginalia_notefigure__" + str(index))

    [#note(
        numbering: none,
        anchor-numbering: anchor-numbering,
        link-anchor: link-anchor,
        counter: counter,
        side: side,
        dy: dy,
        alignment: alignment,
        keep-order: keep-order,
        shift: shift,
        text-style: text-style,
        par-style: par-style,
        block-style: block-style,
        [#figure(
            content,
            gap: gap,
            placement: none,
            ..figureargs,
          )#figure-label],
      )#note-label]
    // for unclear reasons, if this is placed before the note, it becomes part of the content referenced by note-label.
    [#metadata((label: figure-label))<_marginalia_notefigure_meta>]
  }
}

/// Creates a block that extends into the outside/right margin.
///
/// Note: This does not handle page-breaks sensibly.
/// If ```typc config.book = false```, this is not a problem, as then the margins on all pages are the same.
/// However, when using alternating page margins, a multi-page `wideblock` will not work properly.
/// To be able to set this appendix in a many-page wideblock, this code was used:
/// ```typ
/// #show: marginalia.setup.with(..config, book: false)
/// #wideblock(side: "inner")[...]
/// ```
///
/// #compat((
///   "0.1.5": (
///     [`reverse` and `double` have been replaced with @wideblock.side.
///      #ergo[use \````typc side: "inner"```\` instead of \````typc reverse: true```\`]
///      #ergo[use \````typc side: "both"```\` instead of \````typc double: true```\`]],
///   ),
/// ))
/// -> content
#let wideblock(
  /// Which side to extend into.
  /// ```typc auto``` defaults to ```typc "outer"```.
  /// In non-book documents, ```typc "outer"```/```typc "inner"``` are equivalent to ```typc "right"```/```typc "left"``` respectively.
  /// -> auto | "outer" | "inner" | "left" | "right" | "both"
  side: auto,
  /// -> content
  body,
) = (
  context {
    let left-margin = get-left()
    let right-margin = get-right()

    let side = if side == "outer" or side == auto {
      if _config.get().book and calc.even(here().page()) { "left" } else { "right" }
    } else if side == "inner" {
      if _config.get().book and calc.even(here().page()) { "right" } else { "left" }
    } else { side }

    assert(
      side == "left" or side == "right" or side == "both",
      message: "side must be auto, both, left, right, outer, or inner.",
    )

    let left = if side == "both" or side == "left" {
      left-margin.width + left-margin.sep
    } else {
      0pt
    }
    let right = if side == "both" or side == "right" {
      right-margin.width + right-margin.sep
    } else {
      0pt
    }

    let position = here().position().y
    let page_num = str(here().page())
    let pagewidth = if page.flipped { page.height } else { page.width }
    let linewidth = (
      pagewidth
        - left-margin.far
        - left-margin.width
        - left-margin.sep
        - right-margin.far
        - right-margin.width
        - right-margin.sep
    )
    let height = measure(width: linewidth + left + right, body).height

    if left != 0pt {
      let current = _note_extends_left.get().at(page_num, default: ())
      let index = current.len()
      _note_extends_left.update(old => {
        let oldpage = old.at(page_num, default: ())
        oldpage.push((natural: position, height: height, shift: false, keep-order: false))
        old.insert(page_num, oldpage)
        old
      })
    }

    if right != 0pt {
      let current = _note_extends_right.get().at(page_num, default: ())
      let index = current.len()
      _note_extends_right.update(old => {
        let oldpage = old.at(page_num, default: ())
        oldpage.push((natural: position, height: height, shift: false, keep-order: false))
        old.insert(page_num, oldpage)
        old
      })
    }

    pad(left: -left, right: -right, body)
  }
)


// #let header(
//   /// Will be used to ```typc set``` the text style.
//   /// -> dictionary
//   text-style: (:),
//   /// -> optional | (content, content, content)
//   even: (none, none, none),
//   /// -> optional | (content, content, content)
//   odd: (none, none, none),
//   /// -> optional | content
//   inner,
//   /// -> optional | content
//   center,
//   /// -> optional | content
//   outer,
// ) = {}

/// This generates a @wideblock and divides its arguments into three boxes sized to match the margin setup.
/// -> content
#let header(
  /// Will be used to ```typc set``` the text style.
  /// -> dictionary
  text-style: (:),
  /// Up to three positional arguments.
  /// They are interpreted as `⟨outer⟩`, `⟨center⟩⟨outer⟩`, or `⟨inner⟩⟨center⟩⟨outer⟩`,
  /// depending on how many there are.
  ..args,
  /// This is ignored if there are positional parameters or if @setup.book is ```typc false```.
  ///
  /// Otherwise, it is interpreted as `(⟨outer⟩, ⟨center⟩, ⟨inner⟩)` on even pages.
  /// -> array
  even: (),
  /// This is ignored if there are positional parameters.
  ///
  /// Otherwise, it is interpreted as `(⟨inner⟩, ⟨center⟩, ⟨outer⟩)` on odd pages or, if @setup.book is ```typc false```, on all pages.
  /// -> array
  odd: (),
) = context {
  let leftm = get-left()
  let rightm = get-right()
  let is-odd = not _config.get().book or calc.odd(here().page())

  set text(..text-style)

  let pos = args.pos()
  if pos.len() > 0 {
    // if args.named().len() > 0 { panic("cannot have named and positional arguments") }
    if pos.len() == 1 {
      pos = (none, none, ..pos)
    } else if pos.len() == 2 {
      pos = (none, ..pos)
    }
    let (inner, center, outer) = pos
    wideblock(
      side: "both",
      {
        box(width: leftm.width, if is-odd { inner } else { outer })
        h(leftm.sep)
        box(width: 1fr, center)
        h(rightm.sep)
        box(width: rightm.width, if is-odd { outer } else { inner })
      },
    )
  } else {
    wideblock(
      side: "both",
      {
        box(
          width: leftm.width,
          if is-odd {
            odd.at(0, default: none)
          } else {
            even.at(0, default: none)
          },
        )
        h(leftm.sep)
        box(
          width: 1fr,
          if is-odd {
            odd.at(1, default: none)
          } else {
            even.at(1, default: none)
          },
        )
        h(rightm.sep)
        box(
          width: rightm.width,
          if is-odd {
            odd.at(2, default: none)
          } else {
            even.at(2, default: none)
          },
        )
      },
    )
  }
}
