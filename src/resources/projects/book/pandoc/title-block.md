$-- Be very careful about whitespace in this document - line breaks are very meaningful
$-- and it is very easy to break the layout with poorly considered line breaks

$if(subtitle)$$subtitle$$endif$

$-- there are affiliations, render that
$if(by-affiliation/first)$
$for(by-author)$$if(by-author.url)$[$by-author.name.literal$]($by-author.url$)$else$$by-author.name.literal$$endif$$if(by-author.affiliations/first)$
$if(by-author.affiliations/allbutlast)$
 ($for(by-author.affiliations/allbutlast)$$if(it.url)$[$it.name$]($it.url$)$else$$it.name$$endif$, $endfor$$for(by-author.affiliations/last)$$if(it.url)$[$it.name$]($it.url$)$else$$it.name$$endif$$endfor$)  
$else$
 ($for(by-author.affiliations/first)$$if(it.url)$[$it.name$]($it.url$)$else$$it.name$$endif$$endfor$)  
$endif$
$endif$
$endfor$$if(date)$$date$$endif$
$endif$
$-- If there are no affiliations, we can just output authors
$if(by-affiliation)$
$elseif(by-author)$
$for(by-author)$
$if(by-author.url)$| [$by-author.name.literal$]($by-author-url$)  $else$
$by-author.name.literal$  $endif$$endfor$

$if(date)$$date$$endif$
$endif$

$if(abstract)$$abstract$$endif$