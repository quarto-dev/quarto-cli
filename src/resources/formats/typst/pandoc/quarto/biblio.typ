$if(citations)$
$if(csl)$ 
  
#set bibliography(style: "$csl$") 
$elseif(bibliographystyle)$ 

#set bibliography(style: "$bibliographystyle$")
$endif$
$if(bibliography)$

#bibliography($for(bibliography)$"$bibliography$"$sep$,$endfor$)
$endif$
$endif$
