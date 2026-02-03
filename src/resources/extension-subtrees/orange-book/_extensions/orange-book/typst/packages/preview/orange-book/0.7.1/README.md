# orange-book
A book template inspired by The Legrand Orange Book of Mathias Legrand and Vel https://www.latextemplates.com/template/legrand-orange-book.

## Usage
You can use this template in the Typst web app by clicking "Start from template"
on the dashboard and searching for `orange-book`.

Alternatively, you can use the CLI to kick this project off using the command
```
typst init @preview/orange-book
```

Typst will create a new directory with all the files needed to get you started.

## Configuration
This template exports the `book` function with the following named arguments:

- `title`: The book's title as content.
- `subtitle`: The book's subtitle as content.
- `author`: Content or an array of content to specify the author.
- `paper-size`: Defaults to `a4`. Specify a [paper size
  string](https://typst.app/docs/reference/layout/page/#parameters-paper) to
  change the page format.
- `copyright`: Details about the copyright or
  `none`.
- `lowercase-references`: True to have references in lowercase (Eg. table 1.1)

The function also accepts a single, positional argument for the body of the
book.

The template will initialize your package with a sample call to the `book`
function in a show rule. If you, however, want to change an existing project to
use this template, you can add a show rule like this at the top of your file:

```typ
#import "@preview/orange-book:0.7.1": book

#show: book.with(
  title: "Exploring the Physical Manifestation of Humanity’s Subconscious Desires",
  subtitle: "A Practical Guide",
  date: "Anno scolastico 2023-2024",
  author: "Goro Akechi",
  main-color: rgb("#F36619"),
  lang: "en",
  cover: image("./background.svg"),
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

// Your content goes below.
```
