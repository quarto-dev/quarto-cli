$if(citations)$
$if(bibliographystyle)$
#set bibliography(style: "$bibliographystyle$")
$endif$

$for(bibliography)$

#bibliography("$bibliography$")
$endfor$
$endif$
