#import "../../lib.typ": book, part, chapter, my-bibliography, appendices, make-index, index, theorem, mathcal

#set text(font: "Lato")
#show math.equation: set text(font: "Lato Math")
#show raw: set text(font: "Fira Code")

#show: book.with(
  title: "Exploring the Physical Manifestation of Humanity’s Subconscious Desires",
  subtitle: "A Practical Guide",
  date: "Anno scolastico 2023-2024",
  author: "Goro Akechi",
  main-color: rgb("#F36619"),
  lang: "en",
  list-of-figure-title: "List of Figures",
  list-of-table-title: "List of Tables",
  supplement-chapter: "Chapter",
  supplement-part: "PART",
  part-style: 1,
  copyright: [
    Copyright © 2023 Flavio Barisi

    PUBLISHED BY PUBLISHER

    #link("https://github.com/flavio20002/typst-orange-template", "TEMPLATE-WEBSITE")

    Licensed under the Apache 2.0 License (the “License”).
    You may not use this file except in compliance with the License. You may obtain a copy of
    the License at https://www.apache.org/licenses/LICENSE-2.0. Unless required by
    applicable law or agreed to in writing, software distributed under the License is distributed on an
    “AS IS” BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and limitations under the License.

    _First printing, July 2023_
  ]
)

#part("Part One Title")

#chapter("Sectioning Examples")
#index("Sectioning")

== Section Title
#index("Sectioning!Sections")

#lorem(50)
#footnote[Footnote example text...Lorem ipsum dolor sit amet, consectetur adipiscing elit. Praesent porttitor arcu luctus,
imperdiet urna iaculis, mattis eros. Pellentesque iaculis odio vel nisl ullamcorper, nec faucibus ipsum molestie.]

#lorem(50)

=== Subsection Title
#index("Sectioning!Subsections")

#lorem(50)

#lorem(50)

#lorem(50)

==== Subsubsection Title
#index("Sectioning!Subsubsections")

#lorem(100)

===== Paragraph Title
#index("Sectioning!Paragraphs")
#lorem(50)
#lorem(50)
#lorem(50)

#lorem(50)

#lorem(50)

#lorem(50)

#lorem(50)

#lorem(50)

#lorem(50)

#lorem(50)

#lorem(50)

#lorem(50)

#lorem(50)

#lorem(50)

#lorem(50)

#heading(level:2, numbering: none, "Unnumbered Section", outlined: false)
#heading(level:3, numbering: none, "Unnumbered Subsection", outlined: false)
#heading(level:4, numbering: none, "Unnumbered Subsubsection", outlined: false)

