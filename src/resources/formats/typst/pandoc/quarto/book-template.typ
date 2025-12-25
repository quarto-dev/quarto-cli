$definitions.typ()$

#import "@preview/orange-book:0.6.2": book, part, chapter, appendices

$for(header-includes)$
$header-includes$
$endfor$

$book-typst-show.typ()$

$for(include-before)$
$include-before$
$endfor$

$body$

$notes.typ()$

$biblio.typ()$

$for(include-after)$
$include-after$
$endfor$
