---
title: "Test crossrefs"
format:
   latex:
     filters:
       - pandoc-crossref
knit: quarto render
linkReferences: true
nameInLink: true
---

## Image

![Caption](file.jpg){#fig:label width="100" height="100"}

## Math

$$ 
math 
$$ {#eq:label}

## Table

| Col1 | Col2 | Col3 |
|------|------|------|
|   a  |      |      |
|      |      |      |
|      |      |  c   |

:  This is the caption {#tbl:label}

## Section {#sec:section}

This is a section

See @fig:label for more.

See @eq:label for an eqution.

See @tbl:label for a table.

See section @sec:section.
