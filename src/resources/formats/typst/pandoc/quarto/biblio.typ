$if(citations)$
$if(csl)$

#set bibliography(style: "$csl$")
$elseif(bibliographystyle)$

#set bibliography(style: "$bibliographystyle$")
$endif$
$if(bibliography)$
$-- Suppress bibliography display when citation-location: margin (consistent with HTML behavior)
$-- Full citations appear in margins; bibliography is loaded but not displayed
$if(suppress-bibliography)$
#show bibliography: none
$endif$

#bibliography(($for(bibliography)$"$bibliography$"$sep$,$endfor$))
$endif$
$endif$
