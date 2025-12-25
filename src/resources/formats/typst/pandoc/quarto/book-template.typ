$book-numbering.typ()$

$definitions.typ()$

#import "@local/orange-book:0.7.0": book, part, chapter, appendices

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
