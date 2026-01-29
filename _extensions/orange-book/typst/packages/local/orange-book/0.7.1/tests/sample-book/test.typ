#import "../../lib.typ": book, part, chapter, my-bibliography, appendices, make-index, index, theorem, definition, notation,remark,corollary,proposition,example,exercise, problem, vocabulary, mathcal, update-heading-image

//#set text(font: "Linux Libertine")
//#set text(font: "TeX Gyre Pagella")
#set text(font: "Lato")
//#show math.equation: set text(font: "Fira Math")
#show math.equation: set text(font: "Lato Math")
#show raw: set text(font: "Fira Code")

#show: book.with(
  title: "Exploring the Physical Manifestation of Humanity’s Subconscious Desires",
  subtitle: "A Practical Guide",
  date: "Anno scolastico 2023-2024",
  author: "Goro Akechi",
  main-color: rgb("#F36619"),
  lang: "en",
  cover: image("./background.png"),
  image-index: image("./orange1.jpg"),
  list-of-figure-title: "List of Figures",
  list-of-table-title: "List of Tables",
  supplement-chapter: "Chapter",
  supplement-part: "Part",
  part-style: 0,
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
  ],
  lowercase-references: false
)

#part("Part One Title") 

#chapter("Sectioning Examples", image: image("./orange2.jpg"), l: "chap1")
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

// Chapter can also be defined in this way
#update-heading-image(image: image("./orange2.jpg"))
= In-text Element Examples

== Referencing Publications
#index("Citation")
This statement requires citation @Smith:2022jd; this one is more specific @Smith:2021qr[page.~162].
== Link Examples
#index("Links")
This is a URL link: #link("https://www.latextemplates.com")[LaTeX Templates]. This is an email link: #link("mailto:example@example.com")[example\@example.com]. This is a
monospaced URL link: https://www.LaTeXTemplates.com.
== Lists
#index("Lists")
Lists are useful to present information in a concise and/or ordered way.
=== Numbered List
#index("Lists!Numbered List")
+ First numbered item
  + First indented numbered item
  + Second indented numbered item
    + First second-level indented numbered item
    + Second second-level indented numbered item
2. Second numbered item
3. Third numbered item
=== Bullet Point List
#index("Lists!Bullet Points")
- First bullet point item
  - First indented bullet point item
  - Second indented bullet point item
    - First second-level indented bullet point item
- Second bullet point item
- Third bullet point item
=== Descriptions and Definitions
#index("Lists!Descriptions and Definitions")
/ Name: Definition
/ Word: Definition
/ Comment: Elaboration
== International Support
àáâäãåèéêëìíîïòóôöõøùúûüÿýñçˇcšž \
ÀÁÂÄÃÅÈÉÊËÌÍÎÏÒÓÔÖÕØÙÚÛÜŸÝÑ \
ßÇŒÆ ˇCŠŽ
== Ligatures 
fi fj fl ffl ffi Ty

== Referencing Chapters<heading1>
#index("Referencing")
This statement references to another chapter @chap1. This statement references to another heading @heading1. This statement references to another heading @heading2.

#part("Part Two Title")

#chapter("Mathematics", image: image("./orange2.jpg"))

== Theorems
#index("Theorems")
=== Several equations<heading2>
#index("Theorems!Several equations")
This is a theorem consisting of several equations.
#theorem(name: "Name of the theorem")[
  In $E=bb(R)^n$ all norms are equivalent. It has the properties:
  $ abs(norm(bold(x)) - norm(bold(y))) <= norm(bold(x-y)) $
  $ norm(sum_(i=1)^n bold(x)_i) <= sum_(i=1)^n norm(bold(x)_i) quad "where" n "is a finite integer" $
]

=== Single Line
#index("Theorems!Single Line")
This is a theorem consisting of just one line.
#theorem()[
  A set $mathcal(D)(G)$  in dense in $L^2(G)$, $|dot|_0$.
]
== Definitions
#index("Definitions")
A definition can be mathematical or it could define a concept.
#definition(name: "Definition name")[
  Given a vector space $E$, a norm on $E$ is an application, denoted $norm(dot)$, $E$ in $bb(R)^+ = [0,+∞[$ such that:
  $ norm(bold(x)) = 0 arrow.r.double bold(x) = bold(0) $
  $ norm(lambda bold(x)) = abs(lambda) dot norm(bold(x)) $
  $ norm(bold(x) + bold(y)) lt.eq norm(bold(x)) + norm(bold(y))  $
]
== Notations
#index("Notations")

#notation()[
  Given an open subset $G$ of $bold(R)^n$, the set of functions $phi$ are:
  #v(0.5em, weak: true)
  + Bounded support $G$;
  + Infinitely differentiable;
  #v(0.5em, weak: true)
	a vector space is denoted by $mathcal(D)(G)$. 
]
== Remarks
#index("Remarks")
This is an example of a remark.

#remark()[
  The concepts presented here are now in conventional employment in mathematics. Vector spaces are taken over the field $bb(K)=bb(R)$, however, established properties are easily extended to $bb(K)=bb(C)$.
]

== Corollaries
#index("Corollaries")
#corollary(name: "Corollary name")[
	The concepts presented here are now in conventional employment in mathematics. Vector spaces are taken over the field $bb(K)=bb(R)$, however, established properties are easily extended to $bb(K)=bb(C)$.
]
== Propositions
#index("Propositions")
=== Several equations
#index("Propositions!Several equations")

#proposition(name: "Proposition name")[
	It has the properties:
  $ abs(norm(bold(x)) - norm(bold(y))) <= norm(bold(x-y)) $
  $ norm(sum_(i=1)^n bold(x)_i) <= sum_(i=1)^n norm(bold(x)_i) quad "where" n "is a finite integer" $
]
=== Single Line
#index("Propositions!Single Line")

#proposition()[
  	Let $f,g in L^2(G)$; if $forall phi in mathcal(D) (G)$, $(f,phi)_0=(g,phi)_0$ then $f = g$. 
]
== Examples
#index("Examples")
=== Equation Example
#index("Examples!Equation")
#example()[
  Let $G=\(x in bb(R)^2:|x|<3\)$ and denoted by: $x^0=(1,1)$; consider the function:

  $ f(x) = cases(
    e^(abs(x)) quad & "si" |x-x^0| lt.eq 1 slash 2,
    0 & "si" |x-x^0| gt 1 slash 2
  ) $
	
	The function $f$ has bounded support, we can take $A={x in bb(R)^2:|x-x^0| lt.eq 1 slash 2+ epsilon}$ for all $epsilon in lr(\] 0\;5 slash 2-sqrt(2) \[, size: #70%) $.
]

=== Text Example 
#index("Examples!Text")

#example(name: "Example name")[
  Aliquam arcu turpis, ultrices sed luctus ac, vehicula id metus. Morbi eu feugiat velit, et tempus augue. Proin ac mattis tortor. Donec tincidunt, ante rhoncus luctus semper, arcu lorem lobortis justo, nec convallis ante quam quis lectus. Aenean tincidunt sodales massa, et hendrerit tellus mattis ac. Sed non pretium nibh. Donec cursus maximus luctus. Vivamus lobortis eros et massa porta porttitor.
]

== Exercises
#index("Exercises")
#exercise()[
  This is a good place to ask a question to test learning progress or further cement ideas into students' minds.
]
== Problems
#index("Problems")

#problem()[
  What is the average airspeed velocity of an unladen swallow?
]

== Vocabulary
#index("Vocabulary")

Define a word to improve a students' vocabulary.

#vocabulary(name: "Word")[
  Definition of word.
]

#chapter("Presenting Information and Results with a Long Chapter Title", image: image("./orange3.jpg"))
== Table
#index("Table")
Lorem ipsum dolor sit amet, consectetur adipiscing elit. Praesent porttitor arcu luctus, imperdiet
urna iaculis, mattis eros. Pellentesque iaculis odio vel nisl ullamcorper, nec faucibus ipsum molestie.
Sed dictum nisl non aliquet porttitor. Etiam vulputate arcu dignissim, finibus sem et, viverra nisl.
Aenean luctus congue massa, ut laoreet metus ornare in. Nunc fermentum nisi imperdiet lectus
tincidunt vestibulum at ac elit. Nulla mattis nisl eu malesuada suscipit.

#figure(
  table(
  columns: (auto, auto, auto),
  inset: 10pt,
  align: horizon,
  [*Treatments*], [*Response 1*], [*Response 2*],
  [Treatment 1],
  [0.0003262],
  [0.562],
  [Treatment 2],
  [0.0015681],
  [0.910],
  [Treatment 3],
  [0.0009271],
  [0.296],
  ),
  caption: [Table caption.],
) <table>

Referencing @table in-text using its label.

== Figure
#index("Figure")

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Praesent porttitor arcu luctus, imperdiet
urna iaculis, mattis eros. Pellentesque iaculis odio vel nisl ullamcorper, nec faucibus ipsum molestie.
Sed dictum nisl non aliquet porttitor. Etiam vulputate arcu dignissim, finibus sem et, viverra nisl.
Aenean luctus congue massa, ut laoreet metus ornare in. Nunc fermentum nisi imperdiet lectus
tincidunt vestibulum at ac elit. Nulla mattis nisl eu malesuada suscipit.

#figure(
  image("creodocs_logo.svg", width: 50%),
  caption: [Figure caption.],
) <figure>

Referencing @figure in-text using its label and referencing @figure1 in-text using its label.

#figure(
  placement: top,
  table(
  columns: (auto, auto, auto),
  inset: 10pt,
  align: horizon,
  [*Treatments*], [*Response 1*], [*Response 2*],
  [Treatment 1],
  [0.0003262],
  [0.562],
  [Treatment 2],
  [0.0015681],
  [0.910],
  [Treatment 3],
  [0.0009271],
  [0.296],
  ),
  caption: [Floating table.],
) <table1>

#figure(
  placement: bottom,
  image("creodocs_logo.svg", width: 100%),
  caption: [Floating figure.],
) <figure1>

#my-bibliography( bibliography("sample.bib"))

#make-index(title: "Index")

#show: appendices.with("Appendices")

#chapter("Appendix Chapter Title", image: image("./orange2.jpg"))

== Appendix Section Title

#lorem(50)
#chapter("Appendix Chapter Title", image: image("./orange2.jpg"))

== Appendix Section Title

#lorem(50)