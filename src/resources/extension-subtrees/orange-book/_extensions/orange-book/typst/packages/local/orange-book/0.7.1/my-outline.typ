#let my-outline-row( textSize:none,
  textWeight: "regular",
  insetSize: 0pt,
  textColor: blue,
  number: "0",
  title: none,
  heading_page: "0",
  location: none) = {
  set text(size: textSize, fill: textColor, weight: textWeight)
  box(width: 100%, inset: (y: insetSize))[
    #grid(
      columns: (1.2cm, 1fr, auto),
      align: (left+top, left, left),
      gutter: 0pt, 
      number,
      [
        #link(location, title)
        #box(width: 1fr, repeat(text(weight: "regular")[. #h(4pt)]))
      ],
      [
        #h(4pt)
        #link(location, heading_page)
      ]
    )
  ]
}

#let my-outline(appendix-state, appendix-state-hide-parent, part-state, part-location,part-change,part-counter, main-color, textSize1:none, textSize2:none, textSize3:none, textSize4:none, depth: none, outline-font-size: auto) = {
  show outline.entry: it => {
    let appendix-state = appendix-state.at(it.element.location())
    let appendix-state-hide-parent = appendix-state-hide-parent.at(it.element.location())
    let numberingFormat = if appendix-state != none {"A.1"} else {"1.1"}
    let counterInt = counter(heading).at(it.element.location())
    let numberingSetting = it.element.numbering
    let number = none
    if numberingSetting != none and counterInt.first() >0 {
      number = numbering(numberingFormat, ..counterInt)
    }
    let title = it.element.body
    let heading_page = it.page()

    if it.level == 1 {
      let part-state = part-state.at(it.element.location())
      let part-location = part-location.at(it.element.location())
      let part-change = part-change.at(it.element.location())
      let part-counter = part-counter.at(it.element.location())
      if (part-change){
        v(0.7cm, weak: true)
        box(width: 1.1cm, fill: main-color.lighten(80%), inset: 5pt, align(center, text(size: textSize1, weight: "bold", fill: main-color.lighten(30%), numbering("I",part-counter.first()))))
        h(0.1cm)
        box(width: 100% - 1.2cm, fill: main-color.lighten(60%), inset: 5pt, align(center, link(part-location,text(size: textSize1, weight: "bold", part-state))))
        v(0.45cm, weak: true)
      }
      else{
        v(0.5cm, weak: true)
      }
      if (counterInt.first() == 1 and appendix-state != none and not appendix-state-hide-parent ){
        my-outline-row(insetSize: 2pt, textWeight: "bold", textSize: textSize2, textColor:main-color, number: none, title: appendix-state, heading_page: heading_page, location: it.element.location())
        v(0.5cm, weak: true)
      }
      let text-size
      if outline-font-size == auto {
        text-size = textSize2
      }
      else{
        text-size = outline-font-size
      }
      my-outline-row(insetSize: 2pt, textWeight: "bold", textSize: text-size, textColor:main-color, number: number, title: title, heading_page: heading_page, location: it.element.location())
    }
    else if it.level ==2 {
      my-outline-row(insetSize: 2pt, textWeight: "bold", textSize: textSize3, textColor:black, number: number, title: title, heading_page: heading_page, location: it.element.location())
    } else {
       my-outline-row(textWeight: "regular", textSize: textSize4, textColor:black, number: number, title: title, heading_page: heading_page, location: it.element.location())
    }
  }
  outline(depth: depth, indent: 0em)
}

#let my-outline-small(partTitle, appendix-state, part-state, part-location,part-change,part-counter, main-color, textSize1:none, textSize2:none, textSize3:none, textSize4:none, depth: 2, width: 9.5) = {
  show outline.entry: it => {
    let appendix-state = appendix-state.at(it.element.location())
    let numberingFormat = if appendix-state != none {"A.1"} else {"1.1"}
    let counterInt = counter(heading).at(it.element.location())
    let number = none
    if counterInt.first() >0 {
      number = numbering(numberingFormat, ..counterInt)
    }
    let title = it.element.body
    let heading_page = it.page()
    let part-state = part-state.at(it.element.location())
    if (part-state == partTitle and counterInt.first() >0 and appendix-state==none){
      if it.level == 1 {
        v(0.5cm, weak: true)
        my-outline-row(insetSize: 1pt, textWeight: "bold", textSize: textSize2, textColor:main-color, number: number, title: title, heading_page: heading_page, location: it.element.location())
      }
      else if it.level ==2 {
        my-outline-row(textWeight: "regular", textSize: textSize4, textColor:black, number: number, title: text(fill: black, title), heading_page: text(fill: black, heading_page), location: it.element.location())
      }
    }
    else{
      v(-0.65em, weak: true)
    }
  }
  box(width: width, outline(depth: depth, indent: 0em, title: none))
}

#let my-outline-sec(list-of-figure-title, target, textSize) = {
  show outline.entry.where(level: 1): it => {
    let heading_page = it.page()
    [
      #set text(size: textSize)
      #box(width: 100%)[
        #box(width: 0.75cm, align(right, [#it.prefix().at("children").at(2) #h(0.2cm)]))
        #link(it.element.location(), it.element.at("caption").body)
        #box(width: 1fr, repeat(text(weight: "regular")[. #h(4pt)])) 
        #link(it.element.location(),heading_page)
      ]
    ]
  }
  outline(
    title: list-of-figure-title,
    target: target,
  )
}